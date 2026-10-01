
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  company text,
  plan text NOT NULL DEFAULT 'trial',          -- trial|standard
  plan_status text NOT NULL DEFAULT 'active',  -- active|past_due|canceled
  trial_ends_at timestamptz,
  stripe_customer_id text,
  cost_per_km numeric(5,2) NOT NULL DEFAULT 0.45,
  detour_buffer_km int NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  payload_kg int NOT NULL CHECK (payload_kg BETWEEN 100 AND 2500),
  cargo_m3 numeric(4,1) NOT NULL,
  length_cm int, width_cm int, height_cm int,
  pallet_slots int,
  body_type text,                               -- box|curtain|refrigerated|flatbed
  is_default boolean NOT NULL DEFAULT true
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trans_eu_id text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'open',          -- open|closed|expired
  pickup_geo geography(Point,4326) NOT NULL,
  pickup_addr text NOT NULL, pickup_country char(2),
  pickup_from timestamptz, pickup_to timestamptz,
  delivery_geo geography(Point,4326) NOT NULL,
  delivery_addr text NOT NULL, delivery_country char(2),
  delivery_from timestamptz, delivery_to timestamptz,
  weight_kg int, volume_m3 numeric(5,1),
  length_cm int, width_cm int, height_cm int, pallets int,
  cargo_type text,
  price_eur numeric(8,2),
  distance_km int,
  route_line geography(LineString,4326),        -- straight or routed, for geo prefilter
  trans_eu_url text NOT NULL,
  raw_json jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON orders USING gist (pickup_geo);
CREATE INDEX ON orders USING gist (delivery_geo);
CREATE INDEX ON orders (status, pickup_from);

CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  main_order_id uuid NOT NULL REFERENCES orders(id),
  status text NOT NULL DEFAULT 'planned',       -- planned|booked|done|cancelled
  total_km int, total_revenue numeric(9,2), detour_km int,
  start_at timestamptz, end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trip_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id),
  role text NOT NULL,                           -- main|addon
  seq int NOT NULL,
  status text NOT NULL DEFAULT 'pending',       -- pending|booked|dropped|lost
  booked_at timestamptz,
  UNIQUE (trip_id, order_id)
);

CREATE TABLE route_cache (
  key text PRIMARY KEY,                         -- sha1 of ordered stop coords
  polyline text NOT NULL, km numeric(7,1) NOT NULL, minutes int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id bigserial PRIMARY KEY,
  user_id uuid, type text NOT NULL, payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE magic_links (
  token_hash text PRIMARY KEY, email citext NOT NULL,
  expires_at timestamptz NOT NULL, used_at timestamptz
);

ALTER TABLE orders ADD COLUMN missed_syncs int NOT NULL DEFAULT 0;
CREATE TABLE sync_state (source text PRIMARY KEY, cursor text);
CREATE TABLE sync_batches (id bigserial PRIMARY KEY, source text NOT NULL, imported int NOT NULL, closed int NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
