-- ============================================================================
-- ZELEVOS LIVE TRIP SAFETY & REAL-TIME CUSTOMER TRACKING MIGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS trip_tracking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  fulfillment_item_id UUID REFERENCES trip_fulfillment_items(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'READY',
  customer_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  driver_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  driver_name TEXT,
  driver_phone TEXT,
  vehicle_registration TEXT,
  vehicle_model TEXT,
  pickup_location TEXT,
  destination_location TEXT,

  last_customer_latitude DOUBLE PRECISION,
  last_customer_longitude DOUBLE PRECISION,
  last_customer_accuracy DOUBLE PRECISION,
  last_customer_update_at TIMESTAMPTZ,

  last_driver_latitude DOUBLE PRECISION,
  last_driver_longitude DOUBLE PRECISION,
  last_driver_accuracy DOUBLE PRECISION,
  last_driver_heading DOUBLE PRECISION,
  last_driver_speed DOUBLE PRECISION,
  last_driver_update_at TIMESTAMPTZ,

  calculated_distance_km DOUBLE PRECISION,
  distance_updated_at TIMESTAMPTZ,

  emergency_alert_active BOOLEAN NOT NULL DEFAULT FALSE,
  emergency_alert_at TIMESTAMPTZ,
  emergency_alert_resolved_at TIMESTAMPTZ,
  emergency_alert_resolved_by TEXT,
  emergency_alert_notes TEXT,

  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  end_reason TEXT,
  ended_by TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_booking ON trip_tracking_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_customer ON trip_tracking_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_driver ON trip_tracking_sessions(driver_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_vendor ON trip_tracking_sessions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_status ON trip_tracking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_created ON trip_tracking_sessions(created_at);

CREATE TABLE IF NOT EXISTS trip_location_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_session_id UUID NOT NULL REFERENCES trip_tracking_sessions(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'browser_geolocation'
);

CREATE INDEX IF NOT EXISTS idx_location_updates_session ON trip_location_updates(tracking_session_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_booking ON trip_location_updates(booking_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_actor ON trip_location_updates(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_recorded ON trip_location_updates(recorded_at);

CREATE TABLE IF NOT EXISTS trip_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_session_id UUID NOT NULL REFERENCES trip_tracking_sessions(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'SYSTEM',
  actor_id UUID,
  actor_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_session ON trip_tracking_events(tracking_session_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_booking ON trip_tracking_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON trip_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_events_created ON trip_tracking_events(created_at);
