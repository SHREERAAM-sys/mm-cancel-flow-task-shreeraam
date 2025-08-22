-- seed.sql
-- Enabld Row Level Security
-- ===========================
-- Full Cleanup Section (safe)
-- ===========================

DO $$
BEGIN
  -- Drop policies only if tables exist
  IF to_regclass('public.users') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own data" ON public.users;
  END IF;

  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
    DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
  END IF;

  IF to_regclass('public.cancellations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can insert own cancellations" ON public.cancellations;
    DROP POLICY IF EXISTS "Users can view own cancellations" ON public.cancellations;
  END IF;
END$$;

-- Drop functions
DROP FUNCTION IF EXISTS public.fn_get_subscription_by_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.fn_get_cancellations_by_user_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.fn_upsert_subscription(uuid, uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.fn_upsert_cancellation(uuid, uuid, uuid, jsonb) CASCADE;

-- Drop views
DROP VIEW IF EXISTS public.get_v_users CASCADE;

-- Drop tables
DROP TABLE IF EXISTS public.cancellations CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop custom enum types
DROP TYPE IF EXISTS public.applied_count_enum CASCADE;
DROP TYPE IF EXISTS public.emailed_count_enum CASCADE;
DROP TYPE IF EXISTS public.interview_count_enum CASCADE;



-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  monthly_price INTEGER NOT NULL, -- Price in USD cents
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_cancellation', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
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
  subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,

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
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.subscriptions
  WHERE user_id = p_id;
END;
$func$;



CREATE OR REPLACE FUNCTION public.fn_get_cancellations_by_user_id(p_user_id uuid)
RETURNS SETOF public.cancellations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.cancellations
  WHERE user_id = p_user_id
  ORDER BY created_at DESC;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.fn_get_subscription_by_id(uuid)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_cancellations_by_user_id(uuid)  TO anon, authenticated;




CREATE OR REPLACE FUNCTION public.fn_upsert_subscription(
  p_id      uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_patch   jsonb DEFAULT '{}'::jsonb
) RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid   uuid := COALESCE(auth.uid(), p_user_id);
  v_row   public.subscriptions;
  v_price integer := (p_patch->>'monthly_price')::integer;
  v_stat  text    := (p_patch->>'status');
  v_owner uuid;
BEGIN
  -- Must have some user context
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '401: unauthenticated';
  END IF;

  IF p_id IS NOT NULL THEN
    -- Does the row already exist?
    SELECT user_id INTO v_owner
    FROM public.subscriptions
    WHERE id = p_id;

    IF FOUND THEN
      -- Case A: Exists and belongs to same user → UPDATE
      IF v_owner = v_uid THEN
        UPDATE public.subscriptions s
        SET
          monthly_price = COALESCE(v_price, s.monthly_price),
          status        = COALESCE(v_stat,  s.status),
          updated_at    = now()
        WHERE s.id = p_id
        RETURNING s.* INTO v_row;

        RETURN v_row;
      ELSE
        -- Case B: Exists but owned by someone else
        RAISE EXCEPTION '403: forbidden - row belongs to a different user';
      END IF;
    ELSE
      -- Case C: Does not exist → INSERT with given id
      IF v_price IS NULL THEN
        RAISE EXCEPTION '400: monthly_price is required to insert';
      END IF;

      INSERT INTO public.subscriptions(id, user_id, monthly_price, status)
      VALUES (p_id, v_uid, v_price, COALESCE(v_stat, 'active'))
      RETURNING * INTO v_row;

      RETURN v_row;
    END IF;

  ELSE
    -- Case D: No id given → always insert a new one
    IF v_price IS NULL THEN
      RAISE EXCEPTION '400: monthly_price is required to insert';
    END IF;

    INSERT INTO public.subscriptions(user_id, monthly_price, status)
    VALUES (v_uid, v_price, COALESCE(v_stat, 'active'))
    RETURNING * INTO v_row;

    RETURN v_row;
  END IF;
END;
$func$;


GRANT EXECUTE ON FUNCTION public.fn_upsert_subscription(uuid, uuid, jsonb) TO anon, authenticated;




CREATE OR REPLACE FUNCTION public.fn_upsert_cancellation(
  p_id               uuid DEFAULT NULL,
  p_user_id          uuid DEFAULT NULL,
  p_subscription_id  uuid DEFAULT NULL,
  p_patch            jsonb DEFAULT '{}'::jsonb
) RETURNS public.cancellations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_uid    uuid := COALESCE(auth.uid(), p_user_id);
  v_row    public.cancellations;
  v_owner  uuid;
  v_sub    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '401: unauthenticated';
  END IF;

  IF p_id IS NOT NULL THEN
    -- Does the cancellation already exist?
    SELECT user_id, subscription_id
    INTO v_owner, v_sub
    FROM public.cancellations
    WHERE id = p_id;

    IF FOUND THEN
      -- Case A: Belongs to same user → UPDATE
      IF v_owner = v_uid THEN
        UPDATE public.cancellations c
        SET
          subscription_id    = COALESCE(p_subscription_id, c.subscription_id),
          downsell_variant   = COALESCE(p_patch->>'downsell_variant', c.downsell_variant),
          accepted_downsell  = COALESCE((p_patch->>'accepted_downsell')::boolean, c.accepted_downsell),
          feedback           = COALESCE(p_patch->>'feedback'),
          reason             = COALESCE(p_patch->>'reason', c.reason),
          reason_text        = COALESCE(p_patch->>'reason_text', c.reason_text),
          attributed_to_mm   = COALESCE((p_patch->>'attributed_to_mm')::boolean, c.attributed_to_mm),
          applied_count      = COALESCE((p_patch->>'applied_count')::public.applied_count_enum, c.applied_count),
          emailed_count      = COALESCE((p_patch->>'emailed_count')::public.emailed_count_enum, c.emailed_count),
          interview_count    = COALESCE((p_patch->>'interview_count')::public.interview_count_enum, c.interview_count),
          visa_has_lawyer    = COALESCE((p_patch->>'visa_has_lawyer')::boolean, c.visa_has_lawyer),
          visa_type          = COALESCE(p_patch->>'visa_type', c.visa_type),
          updated_at         = now()
        WHERE c.id = p_id
        RETURNING c.* INTO v_row;

        RETURN v_row;
      ELSE
        -- Case B: Exists but owned by someone else
        RAISE EXCEPTION '403: forbidden - cancellation belongs to a different user';
      END IF;

    ELSE
      -- Case C: Does not exist → INSERT with given id
      INSERT INTO public.cancellations (
        id, user_id, subscription_id,
        downsell_variant, accepted_downsell,feedback,
        reason, reason_text, attributed_to_mm,
        applied_count, emailed_count, interview_count,
        visa_has_lawyer, visa_type
      )
      VALUES (
        p_id, v_uid, p_subscription_id,
        p_patch->>'downsell_variant', (p_patch->>'accepted_downsell')::boolean,
        p_patch->>'feedback',
        p_patch->>'reason', p_patch->>'reason_text', (p_patch->>'attributed_to_mm')::boolean,
        (p_patch->>'applied_count')::public.applied_count_enum,
        (p_patch->>'emailed_count')::public.emailed_count_enum,
        (p_patch->>'interview_count')::public.interview_count_enum,
        (p_patch->>'visa_has_lawyer')::boolean, p_patch->>'visa_type'
      )
      RETURNING * INTO v_row;

      RETURN v_row;
    END IF;

  ELSE
    -- Case D: Always insert new cancellation
    INSERT INTO public.cancellations (
      user_id, subscription_id,
      downsell_variant, accepted_downsell,feedback,
      reason, reason_text, attributed_to_mm,
      applied_count, emailed_count, interview_count,
      visa_has_lawyer, visa_type
    )
    VALUES (
      v_uid, p_subscription_id,
      p_patch->>'downsell_variant', (p_patch->>'accepted_downsell')::boolean,
      p_patch->>'feedback',
      p_patch->>'reason', p_patch->>'reason_text', (p_patch->>'attributed_to_mm')::boolean,
      (p_patch->>'applied_count')::public.applied_count_enum,
      (p_patch->>'emailed_count')::public.emailed_count_enum,
      (p_patch->>'interview_count')::public.interview_count_enum,
      (p_patch->>'visa_has_lawyer')::boolean, p_patch->>'visa_type'
    )
    RETURNING * INTO v_row;

    RETURN v_row;
  END IF;
END;
$func$;


GRANT EXECUTE ON FUNCTION public.fn_upsert_cancellation(uuid, uuid, uuid, jsonb) TO anon, authenticated;







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
