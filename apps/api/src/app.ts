import 'reflect-metadata';
import { Body, Controller, Get, Patch, Post, Put, Param, Query, Req, Res, Module, HttpException,
  type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { z, ZodError } from 'zod';
import { addonQuerySchema, magicLinkRequestSchema, tripCreateSchema, tripEditSchema, tripListQuerySchema, tripOrderStatusSchema, type SessionUser } from '@loadlink/core';
import { AuthService, VehicleService, OrderService, ServiceError, enforceRequestLimit,
  SESSION_SECONDS, TripService, type EmailSender } from '@loadlink/services';
import {GoogleAuth} from './google-auth';
import type {AddonDispatcher} from './addon-dispatcher';

export type AppConfig = { appUrl: string; sessionSecret: string; production: boolean; googleClientId?:string; googleClientSecret?:string };
function cookieToken(request: Request): string | undefined {
  return request.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('loadlink_session='))?.slice('loadlink_session='.length);
}
class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof ServiceError) {
      if (error.status === 429) response.setHeader('Retry-After', '60');
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
    } else if (error instanceof ZodError) {
      response.status(400).json({ error: { code: 'INVALID_INPUT', message: error.issues[0]?.message ?? 'Invalid input.' } });
    } else if (error instanceof HttpException) {
      response.status(error.getStatus()).json({ error: { code: 'HTTP_ERROR', message: error.message } });
    } else {
      process.stderr.write(JSON.stringify({ event: 'api_error', message: error instanceof Error ? error.message : 'Unknown error' })+'\n');
      response.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable. Please retry.' } });
    }
  }
}

export async function createApp(pool: Pool, sender: EmailSender, config: AppConfig, addons?: AddonDispatcher) {
  const auth = new AuthService(pool, sender, config.sessionSecret, config.appUrl);
  const google=config.googleClientId&&config.googleClientSecret?new GoogleAuth(config.googleClientId,config.googleClientSecret,config.appUrl,config.sessionSecret):null;
  const vehicles = new VehicleService(pool);
  const orders = new OrderService(pool);
  const trips = new TripService(pool);
  const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: config.production, path: '/', maxAge: SESSION_SECONDS*1000 };
  async function user(request: Request): Promise<SessionUser> {
    const current = await auth.authenticate(cookieToken(request));
    await enforceRequestLimit(pool, `user:${current.id}`);
    return current;
  }
  function sameOrigin(request: Request) {
    if (request.headers.origin !== new URL(config.appUrl).origin)
      throw new ServiceError('INVALID_ORIGIN', 'Request origin is not allowed.', 403);
  }
  @Controller('v1')
  class ApiController {
    @Get('health') async health() { await pool.query('SELECT 1'); return { status: 'ok' }; }
    @Get('auth/google') async googleStart(@Req() request:Request,@Res() response:Response){
      if(!google)return response.redirect(303,config.appUrl+'/login?error=google-unavailable');
      await enforceRequestLimit(pool,'google:'+request.ip,10);
      const flow=google.start();
      response.cookie('loadlink_google',flow.cookie,{...cookieOptions,maxAge:600000,path:'/v1/auth/google'});
      response.redirect(303,flow.url);
    }
    @Get('auth/google/callback') async googleCallback(@Query('code') code:string,@Query('state') state:string,@Req() request:Request,@Res() response:Response){
      const cookie=request.headers.cookie?.split(';').map(value=>value.trim()).find(value=>value.startsWith('loadlink_google='))?.slice('loadlink_google='.length);
      response.clearCookie('loadlink_google',{httpOnly:true,sameSite:'lax',secure:config.production,path:'/v1/auth/google'});
      try{
        if(!google)throw new ServiceError('GOOGLE_AUTH_FAILED','Google sign-in is unavailable.',503);
        const profile=await google.finish(code,state,cookie);
        const result=await auth.createGoogleSession(profile.email,profile.subject,profile.authoritative);
        response.cookie('loadlink_session',result.sessionToken,cookieOptions);
        response.redirect(303,config.appUrl+(result.hasVehicle?'/find':'/onboarding'));
      }catch{
        response.redirect(303,config.appUrl+'/login?error=google-failed');
      }
    }
    @Post('auth/magic-link') async link(@Body() body: unknown, @Req() request: Request) {
      sameOrigin(request);
      await auth.requestLink(magicLinkRequestSchema.parse(body).email);
      return { message: 'Check your inbox' };
    }
    @Post('auth/dev-login') async devLogin(@Body() body: unknown, @Req() request: Request, @Res({passthrough:true}) response: Response) {
      if(config.production)throw new ServiceError('NOT_FOUND','Not found.',404);
      sameOrigin(request);const result=await auth.createDevelopmentSession(magicLinkRequestSchema.parse(body).email);
      response.cookie('loadlink_session',result.sessionToken,cookieOptions);
      return{user:result.user,hasVehicle:result.hasVehicle};
    }
    @Get('auth/callback') async callback(@Query('token') token: string, @Res() response: Response) {
      response.setHeader('Referrer-Policy', 'no-referrer');
      try {
        const result = await auth.consumeLink(token ?? '');
        response.cookie('loadlink_session', result.sessionToken, cookieOptions);
        response.redirect(303, `${config.appUrl}${result.hasVehicle ? '/find' : '/onboarding'}`);
      } catch (error) {
        if (error instanceof ServiceError && error.code === 'INVALID_LINK') response.redirect(303, `${config.appUrl}/login?error=invalid-link`);
        else throw error;
      }
    }
    @Get('auth/me') async me(@Req() request: Request) { return { user: await user(request) }; }
    @Post('auth/logout') async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
      sameOrigin(request); await user(request); await auth.logout(cookieToken(request)!);
      response.clearCookie('loadlink_session', { httpOnly:true,sameSite:'lax',secure:config.production,path:'/' });
      return { message: 'Signed out' };
    }
    @Get('vehicles') async listVehicles(@Req() request: Request) { return { vehicles: await vehicles.list((await user(request)).id) }; }
    @Put('vehicles') async saveVehicle(@Body() body: unknown, @Req() request: Request) {
      sameOrigin(request); return { vehicle: await vehicles.upsert((await user(request)).id, body) };
    }
    @Get('orders') async search(@Query() query: unknown, @Req() request: Request) { return orders.search((await user(request)).id, query); }
    @Get('my-orders') async myOrders(@Req() request:Request){return{orders:await trips.myOrders((await user(request)).id)};}
    @Get('orders/:id') async detail(@Param('id') id: string, @Query('vehicleId') vehicleId: string, @Req() request: Request) {
      return { order: await orders.detail((await user(request)).id, id, vehicleId) };
    }
    @Get('orders/:id/addons') async addonMatches(@Param('id') id: string, @Query() query: unknown, @Req() request: Request) {
      if(!addons)throw new ServiceError('MATCH_UNAVAILABLE','Route matching is temporarily unavailable.',503);
      z.string().uuid().parse(id);
      return addons.get({userId:(await user(request)).id,mainOrderId:id,query:addonQuerySchema.parse(query)});
    }
    @Get('locations') async locations(@Query('q') query: string, @Req() request: Request) {
      await user(request); return { locations: await orders.locations(z.string().max(120).parse(query ?? '')) };
    }
    @Post('trips') async createTrip(@Body() body: unknown,@Req() request:Request){
      if(!addons)throw new ServiceError('MATCH_UNAVAILABLE','Route matching is temporarily unavailable.',503);
      sameOrigin(request);const current=await user(request);const input=tripCreateSchema.parse(body);
      const matches=await addons.get({userId:current.id,mainOrderId:input.mainOrderId,query:{vehicleId:input.vehicleId,bufferKm:25,addonOrderIds:input.addonOrderIds}},{fresh:true});
      return{trip:await trips.create(current.id,input,matches.trip)};
    }
    @Get('trips') async tripList(@Query() query:unknown,@Req() request:Request){
      const input=tripListQuerySchema.parse(query);return{trips:await trips.list((await user(request)).id,input.status)};
    }
    @Get('trips/:id') async tripDetail(@Param('id') id:string,@Req() request:Request){
      z.string().uuid().parse(id);return{trip:await trips.detail((await user(request)).id,id)};
    }
    @Patch('trip-orders/:id') async markTripOrder(@Param('id') id:string,@Body() body:unknown,@Req() request:Request){
      sameOrigin(request);z.string().uuid().parse(id);const input=tripOrderStatusSchema.parse(body);
      return{trip:await trips.mark((await user(request)).id,id,input.status)};
    }
    @Put('trips/:id') async updateTrip(@Param('id') id:string,@Body() body:unknown,@Req() request:Request){
      if(!addons)throw new ServiceError('MATCH_UNAVAILABLE','Route matching is temporarily unavailable.',503);
      sameOrigin(request);z.string().uuid().parse(id);const current=await user(request);const input=tripEditSchema.parse(body);
      const trip=await trips.detail(current.id,id);
      const main=trip.orders.find(order=>order.role==='main');
      if(!main)throw new ServiceError('TRIP_NOT_FOUND','Trip not found.',404);
      const matches=await addons.get({userId:current.id,mainOrderId:main.orderId,query:{vehicleId:trip.vehicleId,tripId:id,bufferKm:25,addonOrderIds:input.addonOrderIds}},{fresh:true});
      return{trip:await trips.update(current.id,id,input,matches.trip)};
    }
    @Patch('trips/:id') async updateStatus(@Param('id') id:string,@Body() body:unknown,@Req() request:Request){
      sameOrigin(request);z.string().uuid().parse(id);const current=await user(request);
      const input=z.object({action:z.enum(['cancel','complete']).default('cancel')}).strict().parse(body??{});
      return input.action==='complete'?{trip:await trips.complete(current.id,id)}:trips.cancel(current.id,id);
    }
  }
  @Module({ controllers: [ApiController] }) class AppModule {}
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.useGlobalFilters(new ErrorFilter());
  app.use((_request: Request, response: Response, next: () => void) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer'); next();
  });
  return app;
}
