import type {OrderSource} from '@loadlink/core';
import type {Pool} from 'pg';
import {normalize} from './fixtures';
export async function syncOrders(pool:Pool,source:OrderSource,name:string) {
 const db=await pool.connect();
 try {
 await db.query('BEGIN');
 await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[name]);
 const state=await db.query('SELECT cursor FROM sync_state WHERE source=$1',[name]);
 const batch=await source.fetchSince(state.rows[0]?.cursor??null);
 const orders=batch.orders.map(normalize);
 // Closure is confirmed by two successful availability checks, including explicit feed closures.
 const importOrders=orders.map(o=>o.status==='closed'?{...o,status:'open' as const}:o); 
 for(const o of importOrders) await db.query(`INSERT INTO orders
 (trans_eu_id,status,pickup_geo,pickup_addr,pickup_from,pickup_to,delivery_geo,delivery_addr,delivery_from,delivery_to,weight_kg,volume_m3,price_eur,trans_eu_url,raw_json,pickup_country,delivery_country,distance_km,length_cm,width_cm,height_cm)
 VALUES ($1,$2,ST_SetSRID(ST_MakePoint($3,$4),4326)::geography,$5,$6,$7,ST_SetSRID(ST_MakePoint($8,$9),4326)::geography,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
 ON CONFLICT(trans_eu_id) DO UPDATE SET status=EXCLUDED.status,pickup_geo=EXCLUDED.pickup_geo,pickup_addr=EXCLUDED.pickup_addr,pickup_from=EXCLUDED.pickup_from,pickup_to=EXCLUDED.pickup_to,delivery_geo=EXCLUDED.delivery_geo,delivery_addr=EXCLUDED.delivery_addr,delivery_from=EXCLUDED.delivery_from,delivery_to=EXCLUDED.delivery_to,weight_kg=EXCLUDED.weight_kg,volume_m3=EXCLUDED.volume_m3,price_eur=EXCLUDED.price_eur,trans_eu_url=EXCLUDED.trans_eu_url,raw_json=EXCLUDED.raw_json,pickup_country=EXCLUDED.pickup_country,delivery_country=EXCLUDED.delivery_country,distance_km=EXCLUDED.distance_km,length_cm=EXCLUDED.length_cm,width_cm=EXCLUDED.width_cm,height_cm=EXCLUDED.height_cm,synced_at=now()`,
 [o.id,o.status,o.pickup.lon,o.pickup.lat,o.pickupAddress,o.pickupFrom,o.pickupTo,o.delivery.lon,o.delivery.lat,o.deliveryAddress,o.deliveryFrom,o.deliveryTo,o.weightKg,o.volumeM3,o.priceEur,o.url,JSON.stringify(o),o.pickupCountry,o.deliveryCountry,o.distanceKm===null?null:Math.round(o.distanceKm),o.lengthCm,o.widthCm,o.heightCm]);
 const open=await db.query("SELECT trans_eu_id FROM orders WHERE status='open'");
 const closed=await source.fetchClosedIds(open.rows.map(r=>r.trans_eu_id));
 await db.query("UPDATE orders SET missed_syncs=CASE WHEN trans_eu_id=ANY($1::text[]) THEN missed_syncs+1 ELSE 0 END WHERE status='open'",[closed]);
 const result=await db.query("UPDATE orders SET status=CASE WHEN pickup_to<now() THEN 'expired' ELSE 'closed' END WHERE status='open' AND (missed_syncs>=2 OR pickup_to<now())");
 await db.query('INSERT INTO sync_state(source,cursor) VALUES($1,$2) ON CONFLICT(source) DO UPDATE SET cursor=EXCLUDED.cursor',[name,batch.nextCursor]);
 await db.query('INSERT INTO sync_batches(source,imported,closed) VALUES($1,$2,$3)',[name,orders.length,result.rowCount]);
 await db.query('COMMIT');
 return {imported:orders.length,closed:result.rowCount};
 } catch(error) {await db.query('ROLLBACK');throw error;} finally {db.release();}
}
