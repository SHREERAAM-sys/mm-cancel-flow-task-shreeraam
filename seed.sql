-- seed.sql
-- Database schema and seed data for subscription cancellation flow
-- Does not include production-level optimizations or advanced RLS policies

-- Enable Row Level Security

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  monthly_price INTEGER NOT NULL, -- Price in USD cents
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_cancellation', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'applied_count_enum') THEN
    CREATE TYPE applied_count_enum   AS ENUM ('0','1-5','6-20','20+');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emailed_count_enum') THEN
    CREATE TYPE emailed_count_enum   AS ENUM ('0','1-5','6-20','20+');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_count_enum') THEN
    CREATE TYPE interview_count_enum AS ENUM ('0','1-2','3-5','5+');
  END IF;
END$$;

-- Cancellations table (new)
CREATE TABLE IF NOT EXISTS cancellations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id  UUID     REFERENCES subscriptions(id) ON DELETE CASCADE,

  -- A/B + offer
  downsell_variant TEXT     NULL CHECK (downsell_variant IN ('A','B')),
  accepted_downsell BOOLEAN NULL,

  -- Survey / usage
  feedback            TEXT     NULL,
  reason            TEXT     NULL,
  reason_text       TEXT     NULL,
  attributed_to_mm  BOOLEAN  NULL,                         -- did user attribute job to MM (yes/no)
  applied_count     applied_count_enum   NULL,
  emailed_count     emailed_count_enum   NULL,
  interview_count   interview_count_enum NULL,

  -- Visa follow-up (YES flow)
  visa_has_lawyer   BOOLEAN  NULL,
  visa_type         TEXT     NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_cancellations_user       ON cancellations(user_id);
CREATE INDEX IF NOT EXISTS idx_cancellations_subscription ON cancellations(subscription_id);
CREATE INDEX IF NOT EXISTS idx_cancellations_created_at ON cancellations(created_at);


-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellations ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (candidates should enhance these)
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cancellations" ON cancellations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own cancellations" ON cancellations
  FOR SELECT USING (auth.uid() = user_id);



CREATE OR REPLACE VIEW get_v_users
 AS
SELECT id, email, created_at
FROM public.users;

GRANT SELECT ON get_v_users TO anon;

CREATE OR REPLACE FUNCTION public.fn_get_subscription_by_id(p_id uuid)
RETURNS SETOF public.subscriptions
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.subscriptions
  WHERE id = p_id;
END;
$func$;


CREATE OR REPLACE FUNCTION public.fn_get_cancellations_by_user(p_user_id uuid)
RETURNS SETOF public.cancellations
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.cancellations
  WHERE user_id = p_user_id
  ORDER BY created_at DESC;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.fn_get_subscription_by_id(uuid)     TO anon;
GRANT EXECUTE ON FUNCTION public.fn_get_cancellations_by_user(uuid)  TO anon;






-- Seed data
INSERT INTO users (id, email) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'user1@example.com'),
  ('550e8400-e29b-41d4-a716-446655440002', 'user2@example.com'),
  ('550e8400-e29b-41d4-a716-446655440003', 'user3@example.com')
ON CONFLICT (email) DO NOTHING;

-- Seed subscriptions with $25 and $29 plans
INSERT INTO subscriptions (user_id, monthly_price, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 2500, 'active'), -- $25.00
  ('550e8400-e29b-41d4-a716-446655440002', 2900, 'active'), -- $29.00
  ('550e8400-e29b-41d4-a716-446655440003', 2500, 'active')  -- $25.00
ON CONFLICT DO NOTHING; 