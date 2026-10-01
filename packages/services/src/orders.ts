import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { searchQuerySchema, type Location, type OrderCard, type SearchQuery, type SearchResult } from '@loadlink/core';
import { VehicleService } from './vehicles';
import { ServiceError } from './errors';

const cursorSchema = z.object({ offset: z.number().int().min(0).max(100000), key: z.string() });
const sortSql = {
  rate: 'price_eur / NULLIF(distance_km,0) DESC NULLS LAST, id',
  price: 'price_eur DESC NULLS LAST, id',
  pickup: 'pickup_from ASC, id',
} as const;
const pageSize = 20;
function queryKey(q: SearchQuery) {
  return createHash('sha256').update(JSON.stringify([q.from,q.to,q.date,q.vehicleId,q.sort])).digest('hex');
}
function decodeCursor(cursor: string | undefined, key: string) {
  if (!cursor) return 0;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('Invalid encoding');
    const data = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
    if (data.key !== key) throw new Error('Different search');
    return data.offset;
  } catch { throw new ServiceError('INVALID_CURSOR', 'Search changed. Please start again.', 400); }
}
function prefix(value: string) { return `${value.replace(/[\\%_]/g, '\\$&')}%`; }

type OrderRow = {
  id: string; pickup_addr: string; delivery_addr: string; pickup_country: string | null; delivery_country: string | null;
  pickup_from: Date; pickup_to: Date; delivery_from: Date; delivery_to: Date;
  weight_kg: number; volume_m3: string | null; price_eur: string | null; distance_km: number | null;
  synced_at: Date; length_cm: number | null; width_cm: number | null; height_cm: number | null;
};
function fromRow(row: OrderRow, dimensionsUnknown: boolean): OrderCard {
  return { id: row.id, pickupAddress: row.pickup_addr, deliveryAddress: row.delivery_addr,
    pickupCountry: row.pickup_country, deliveryCountry: row.delivery_country,
    pickupFrom: row.pickup_from.toISOString(), pickupTo: row.pickup_to.toISOString(),
    deliveryFrom: row.delivery_from.toISOString(), deliveryTo: row.delivery_to.toISOString(),
    weightKg: row.weight_kg, volumeM3: row.volume_m3 === null ? null : Number(row.volume_m3),
    priceEur: row.price_eur === null ? null : Number(row.price_eur), distanceKm: row.distance_km,
    syncedAt: row.synced_at.toISOString(), dimensionsUnknown };
}
function dimensionsUnknown(row: OrderRow, vehicle: { lengthCm: number | null; widthCm: number | null; heightCm: number | null }) {
  return (row.length_cm !== null && vehicle.lengthCm === null) ||
    (row.width_cm !== null && vehicle.widthCm === null) || (row.height_cm !== null && vehicle.heightCm === null);
}
export class OrderService {
  private vehicles: VehicleService;
  constructor(private pool: Pool) { this.vehicles = new VehicleService(pool); }
  async search(userId: string, rawQuery: unknown): Promise<SearchResult> {
    const q = searchQuerySchema.parse(rawQuery);
    const vehicle = await this.vehicles.getOwned(userId, q.vehicleId);
    const key = queryKey(q);
    const offset = decodeCursor(q.cursor, key);
    const result = await this.pool.query<OrderRow>(
      `SELECT id,pickup_addr,delivery_addr,pickup_country,delivery_country,pickup_from,pickup_to,
       delivery_from,delivery_to,weight_kg,volume_m3,price_eur,distance_km,synced_at,length_cm,width_cm,height_cm
       FROM orders WHERE status='open' AND pickup_to>now()
       AND pickup_from < (($1::date + 1)::timestamp AT TIME ZONE 'UTC')
       AND pickup_to >= ($1::date::timestamp AT TIME ZONE 'UTC')
       AND pickup_from IS NOT NULL AND pickup_to IS NOT NULL AND delivery_from IS NOT NULL AND delivery_to IS NOT NULL
       AND lower(pickup_addr) LIKE lower($2) AND lower(delivery_addr) LIKE lower($3)
       AND weight_kg IS NOT NULL AND weight_kg <= $4 AND (volume_m3 IS NULL OR volume_m3 <= $5)
       AND ($6::int IS NULL OR length_cm IS NULL OR length_cm <= $6)
       AND ($7::int IS NULL OR width_cm IS NULL OR width_cm <= $7)
       AND ($8::int IS NULL OR height_cm IS NULL OR height_cm <= $8)
       ORDER BY ${sortSql[q.sort]} LIMIT $9 OFFSET $10`,
      [q.date,prefix(q.from),prefix(q.to),vehicle.payloadKg*0.95,vehicle.cargoM3*0.95,
        vehicle.lengthCm,vehicle.widthCm,vehicle.heightCm,pageSize+1,offset]);
    const orders = result.rows.slice(0,pageSize).map(row => fromRow(row, dimensionsUnknown(row,vehicle)));
    const latest = await this.pool.query<{ updated_at: Date | null }>('SELECT max(created_at) AS updated_at FROM sync_batches');
    return { orders, nextCursor: result.rows.length > pageSize ? Buffer.from(JSON.stringify({ offset: offset+pageSize, key })).toString('base64url') : null,
      updatedAt: latest.rows[0].updated_at?.toISOString() ?? null };
  }
  async detail(userId: string, id: string, vehicleId: string): Promise<OrderCard> {
    z.string().uuid().parse(id); z.string().uuid().parse(vehicleId);
    const vehicle = await this.vehicles.getOwned(userId, vehicleId);
    const result = await this.pool.query<OrderRow>(
      `SELECT id,pickup_addr,delivery_addr,pickup_country,delivery_country,pickup_from,pickup_to,
       delivery_from,delivery_to,weight_kg,volume_m3,price_eur,distance_km,synced_at,length_cm,width_cm,height_cm
       FROM orders WHERE id=$1 AND status='open' AND pickup_to>now()
       AND weight_kg IS NOT NULL AND weight_kg <= $2 AND (volume_m3 IS NULL OR volume_m3 <= $3)
       AND ($4::int IS NULL OR length_cm IS NULL OR length_cm <= $4)
       AND ($5::int IS NULL OR width_cm IS NULL OR width_cm <= $5)
       AND ($6::int IS NULL OR height_cm IS NULL OR height_cm <= $6)
       AND pickup_from IS NOT NULL AND pickup_to IS NOT NULL AND delivery_from IS NOT NULL AND delivery_to IS NOT NULL`,
      [id,vehicle.payloadKg*0.95,vehicle.cargoM3*0.95,vehicle.lengthCm,vehicle.widthCm,vehicle.heightCm]);
    if (!result.rows[0]) throw new ServiceError('ORDER_GONE', 'This order is no longer available for your van.', 404);
    return fromRow(result.rows[0], dimensionsUnknown(result.rows[0],vehicle));
  }
  async locations(query: string): Promise<Location[]> {
    z.string().max(120).parse(query);
    const result = await this.pool.query<{ name: string; country: string | null }>(
      `SELECT DISTINCT name,country FROM (
        SELECT pickup_addr AS name,pickup_country AS country FROM orders WHERE status='open' AND pickup_to>now()
        UNION SELECT delivery_addr,delivery_country FROM orders WHERE status='open' AND pickup_to>now()
       ) locations WHERE name ILIKE $1 ORDER BY name LIMIT 20`, [prefix(query)]);
    return result.rows;
  }
}
