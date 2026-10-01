import type { Pool } from 'pg';
import { vehicleInputSchema, type Vehicle } from '@loadlink/core';
import { ServiceError } from './errors';

type VehicleRow = {
  id: string; name: string; payload_kg: number; cargo_m3: string;
  length_cm: number | null; width_cm: number | null; height_cm: number | null; is_default: boolean;
};
function fromRow(row: VehicleRow): Vehicle {
  return { id: row.id, name: row.name, payloadKg: row.payload_kg, cargoM3: Number(row.cargo_m3),
    lengthCm: row.length_cm, widthCm: row.width_cm, heightCm: row.height_cm, isDefault: row.is_default };
}
export class VehicleService {
  constructor(private pool: Pick<Pool,'query'>) {}
  async list(userId: string): Promise<Vehicle[]> {
    const result = await this.pool.query<VehicleRow>('SELECT * FROM vehicles WHERE user_id=$1 AND is_default', [userId]);
    return result.rows.map(fromRow);
  }
  async getOwned(userId: string, vehicleId: string, lock=false): Promise<Vehicle> {
    const result = await this.pool.query<VehicleRow>(`SELECT * FROM vehicles WHERE id=$1 AND user_id=$2 ${lock?'FOR SHARE':''}`, [vehicleId, userId]);
    if (!result.rows[0]) throw new ServiceError('VEHICLE_NOT_FOUND', 'Vehicle not found.', 404);
    return fromRow(result.rows[0]);
  }
  async upsert(userId: string, raw: unknown): Promise<Vehicle> {
    const v = vehicleInputSchema.parse(raw);
    const result = await this.pool.query<VehicleRow>(
      `INSERT INTO vehicles(user_id,name,payload_kg,cargo_m3,length_cm,width_cm,height_cm,is_default)
       VALUES($1,$2,$3,$4,$5,$6,$7,true) ON CONFLICT(user_id) WHERE is_default DO UPDATE SET
       name=EXCLUDED.name,payload_kg=EXCLUDED.payload_kg,cargo_m3=EXCLUDED.cargo_m3,
       length_cm=EXCLUDED.length_cm,width_cm=EXCLUDED.width_cm,height_cm=EXCLUDED.height_cm RETURNING *`,
      [userId,v.name,v.payloadKg,v.cargoM3,v.lengthCm,v.widthCm,v.heightCm]);
    return fromRow(result.rows[0]);
  }
}
