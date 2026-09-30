CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE auth_requests (
  id bigserial PRIMARY KEY,
  email citext NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_requests_email_time_idx ON auth_requests(email, requested_at);

CREATE TABLE request_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count int NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX vehicles_default_user_idx ON vehicles(user_id) WHERE is_default;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_positive_volume CHECK (cargo_m3 > 0);
ALTER TABLE vehicles ADD CONSTRAINT vehicles_positive_dimensions CHECK (
  (length_cm IS NULL OR length_cm > 0) AND
  (width_cm IS NULL OR width_cm > 0) AND
  (height_cm IS NULL OR height_cm > 0)
);
CREATE INDEX orders_search_route_date_idx ON orders(lower(pickup_addr), lower(delivery_addr), pickup_from)
  WHERE status = 'open';
