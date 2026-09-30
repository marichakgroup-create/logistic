import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const magicLinkRequestSchema = z.object({ email: emailSchema }).strict();
export const vehicleInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  payloadKg: z.number().int().min(100).max(2500),
  cargoM3: z.number().min(0.1).max(99.9).multipleOf(0.1),
  lengthCm: z.number().int().min(1).max(1000).nullable().default(null),
  widthCm: z.number().int().min(1).max(400).nullable().default(null),
  heightCm: z.number().int().min(1).max(400).nullable().default(null),
}).strict();
export type VehicleInput = z.infer<typeof vehicleInputSchema>;
export type Vehicle = VehicleInput & { id: string; isDefault: boolean };
export type SessionUser = {
  id: string; email: string; plan: string; planStatus: string;
  trialEndsAt: string | null;
};

// Starting values, not manufacturer guarantees. Operators must confirm their van's figures.
export const vehiclePresets: VehicleInput[] = [
  { name: 'Sprinter', payloadKg: 1200, cargoM3: 10.5, lengthCm: 326, widthCm: 178, heightCm: 194 },
  { name: 'Crafter', payloadKg: 1200, cargoM3: 10.7, lengthCm: 345, widthCm: 183, heightCm: 196 },
  { name: 'Ducato', payloadKg: 1400, cargoM3: 11.5, lengthCm: 312, widthCm: 187, heightCm: 193 },
  { name: 'Transit', payloadKg: 1200, cargoM3: 10, lengthCm: 304, widthCm: 178, heightCm: 188 },
  { name: 'Master', payloadKg: 1300, cargoM3: 10.8, lengthCm: 308, widthCm: 176, heightCm: 189 },
  { name: 'Vito', payloadKg: 900, cargoM3: 6, lengthCm: 283, widthCm: 168, heightCm: 139 },
  { name: 'Custom', payloadKg: 1000, cargoM3: 6.8, lengthCm: 292, widthCm: 177, heightCm: 143 },
];

export type Cargo = {
  weightKg: number | null; volumeM3: number | null;
  lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null;
};
export function cargoFitsVehicle(cargo: Cargo, vehicle: VehicleInput): boolean {
  if (cargo.weightKg === null || cargo.weightKg > vehicle.payloadKg * 0.95) return false;
  if (cargo.volumeM3 !== null && cargo.volumeM3 > vehicle.cargoM3 * 0.95) return false;
  for (const dimension of ['lengthCm', 'widthCm', 'heightCm'] as const) {
    const size = cargo[dimension];
    const interior = vehicle[dimension];
    if (size != null && interior != null && size > interior) return false;
  }
  return true;
}

export const searchQuerySchema = z.object({
  from: z.string().trim().max(120).default(''),
  to: z.string().trim().max(120).default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Invalid date'),
  vehicleId: z.string().uuid(),
  sort: z.enum(['rate', 'price', 'pickup']).default('rate'),
  cursor: z.string().max(300).optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type OrderCard = {
  id: string; pickupAddress: string; deliveryAddress: string;
  pickupCountry: string | null; deliveryCountry: string | null;
  pickupFrom: string; pickupTo: string; deliveryFrom: string; deliveryTo: string;
  weightKg: number; volumeM3: number | null; priceEur: number | null;
  distanceKm: number | null; syncedAt: string;
  dimensionsUnknown: boolean;
};
export type SearchResult = { orders: OrderCard[]; nextCursor: string | null; updatedAt: string | null };
export type Location = { name: string; country: string | null };
export const tripCreateSchema=z.object({
 vehicleId:z.string().uuid(),
 mainOrderId:z.string().uuid(),
 addonOrderIds:z.array(z.string().uuid()).max(4).default([])
}).strict().refine(value=>new Set(value.addonOrderIds).size===value.addonOrderIds.length,'Duplicate add-on orders');
export type TripCreate=z.infer<typeof tripCreateSchema>;
export type CreatedTrip={id:string;status:'planned';totalKm:number|null;totalRevenue:number;detourKm:number;startAt:string;endAt:string};
export const tripOrderStatusSchema=z.object({status:z.enum(['booked','dropped'])}).strict();
export type TripOrderItem={tripOrderId:string;orderId:string;role:'main'|'addon';status:'pending'|'booked'|'dropped'|'lost';pickupAddress:string;deliveryAddress:string;pickupFrom:string;deliveryTo:string;priceEur:number|null;weightKg:number|null;volumeM3:number|null;transEuUrl:string};
export type TripDetail={id:string;status:'planned'|'booked'|'done'|'cancelled';totalKm:number|null;totalRevenue:number;detourKm:number;startAt:string;endAt:string;vehicleName:string;orders:TripOrderItem[]};
export const tripListQuerySchema=z.object({status:z.enum(['planned','booked','done','cancelled']).optional()});
export type TripListItem={id:string;status:TripDetail['status'];pickupAddress:string;deliveryAddress:string;totalKm:number|null;totalRevenue:number;startAt:string;endAt:string;orderCount:number};
