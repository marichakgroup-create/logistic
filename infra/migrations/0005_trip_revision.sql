ALTER TABLE trips ADD COLUMN revision integer NOT NULL DEFAULT 0;
ALTER TABLE trip_orders ADD COLUMN confirmed_order jsonb;
UPDATE trip_orders x SET confirmed_order = saved.value
FROM trips t, LATERAL jsonb_array_elements(COALESCE(t.route_plan->'orders','[]'::jsonb)) saved(value)
WHERE x.trip_id=t.id AND x.status='booked' AND saved.value->>'id'=x.order_id::text;
