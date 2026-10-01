import { z } from 'zod';
export * from './account';
export * from './matching';
export const pointSchema = z.object({lat:z.number().min(-90).max(90),lon:z.number().min(-180).max(180)});
export const orderSchema = z.object({
 id:z.string().min(1),status:z.enum(['open','closed','expired']),
 pickup:pointSchema,delivery:pointSchema,pickupAddress:z.string(),deliveryAddress:z.string(),
 pickupFrom:z.string().datetime(),pickupTo:z.string().datetime(),deliveryFrom:z.string().datetime(),deliveryTo:z.string().datetime(),
 weightKg:z.number().nonnegative().nullable(),volumeM3:z.number().nonnegative().nullable(),
 priceEur:z.number().nonnegative().nullable(),url:z.string().url(),
 pickupCountry:z.string().regex(/^[A-Z]{2}$/).nullable().default(null),
 deliveryCountry:z.string().regex(/^[A-Z]{2}$/).nullable().default(null),
 distanceKm:z.number().nonnegative().nullable().default(null),
 lengthCm:z.number().int().positive().nullable().default(null),
 widthCm:z.number().int().positive().nullable().default(null),
 heightCm:z.number().int().positive().nullable().default(null)
}).refine(o=>Date.parse(o.pickupFrom)<=Date.parse(o.pickupTo)&&Date.parse(o.deliveryFrom)<=Date.parse(o.deliveryTo),'Invalid time windows');
export type Order = z.infer<typeof orderSchema>;
export type RawOrder = unknown;
export interface OrderSource {
 fetchSince(cursor:string|null):Promise<{orders:RawOrder[];nextCursor:string}>;
 fetchClosedIds(ids:string[]):Promise<string[]>;
}
export type Point = z.infer<typeof pointSchema>;
export type Route = {polyline:string;km:number;minutes:number};
export interface RoutingProvider { route(stops:Point[]):Promise<Route>; }
