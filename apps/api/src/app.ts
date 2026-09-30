import 'reflect-metadata';
import { Body, Controller, Get, Post, Put, Param, Query, Req, Res, Module, HttpException,
  type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { z, ZodError } from 'zod';
import { magicLinkRequestSchema, type SessionUser } from '@loadlink/core';
import { AuthService, VehicleService, OrderService, ServiceError, enforceRequestLimit,
  SESSION_SECONDS, type EmailSender } from '@loadlink/services';

export type AppConfig = { appUrl: string; sessionSecret: string; production: boolean };
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

export async function createApp(pool: Pool, sender: EmailSender, config: AppConfig) {
  const auth = new AuthService(pool, sender, config.sessionSecret, config.appUrl);
  const vehicles = new VehicleService(pool);
  const orders = new OrderService(pool);
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
    @Post('auth/magic-link') async link(@Body() body: unknown, @Req() request: Request) {
      sameOrigin(request);
      await auth.requestLink(magicLinkRequestSchema.parse(body).email);
      return { message: 'Check your inbox' };
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
    @Get('orders/:id') async detail(@Param('id') id: string, @Query('vehicleId') vehicleId: string, @Req() request: Request) {
      return { order: await orders.detail((await user(request)).id, id, vehicleId) };
    }
    @Get('locations') async locations(@Query('q') query: string, @Req() request: Request) {
      await user(request); return { locations: await orders.locations(z.string().max(120).parse(query ?? '')) };
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
