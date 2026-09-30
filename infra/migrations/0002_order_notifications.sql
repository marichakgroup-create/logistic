CREATE TABLE order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_order_id uuid NOT NULL REFERENCES trip_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_order_id, kind)
);
CREATE INDEX order_notifications_pending_idx ON order_notifications(created_at) WHERE sent_at IS NULL;
