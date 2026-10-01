import { describe, expect, it } from 'vitest';
import { cargoFitsVehicle, searchQuerySchema, vehicleInputSchema, vehiclePresets } from './account';

describe('vehicle capacity', () => {
  const vehicle=vehiclePresets[0];
  it('uses the conservative 95% payload boundary', () => {
    expect(cargoFitsVehicle({weightKg:vehicle.payloadKg*.95,volumeM3:1},vehicle)).toBe(true);
    expect(cargoFitsVehicle({weightKg:vehicle.payloadKg*.96,volumeM3:1},vehicle)).toBe(false);
  });
  it('rejects unknown weight and allows unknown volume', () => {
    expect(cargoFitsVehicle({weightKg:null,volumeM3:1},vehicle)).toBe(false);
    expect(cargoFitsVehicle({weightKg:200,volumeM3:null},vehicle)).toBe(true);
  });
  it('checks supplied cargo dimensions', () => {
    expect(cargoFitsVehicle({weightKg:200,volumeM3:1,lengthCm:vehicle.lengthCm!+1},vehicle)).toBe(false);
  });
});

describe('M1 input validation', () => {
  it('rejects payload above the 2.5 tonne product limit', () => {
    expect(vehicleInputSchema.safeParse({...vehiclePresets[0],payloadKg:2501}).success).toBe(false);
  });
  it('rejects impossible calendar dates', () => {
    expect(searchQuerySchema.safeParse({date:'2026-02-30',vehicleId:'3ed920dc-e0b6-46d3-8544-9adf460d14e8'}).success).toBe(false);
  });
});
