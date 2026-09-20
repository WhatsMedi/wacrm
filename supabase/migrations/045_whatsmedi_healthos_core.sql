-- ============================================================
-- WHATS MEDI HEALTHOS CORE CLINICAL MODEL v1
-- Migration 045
--
-- Principles:
--   - HealthOS owns health/clinical data.
--   - WACRM owns communication and CRM data.
--   - WhatsMedi Identity owns person identity.
--   - Clinical data is always account + person scoped.
--   - Provenance and verification are first-class.
--   - Terminology fields are standards-ready without requiring
--     a terminology server in v1.
--   - AI-derived information must remain distinguishable from
--     verified clinical information.
-- ============================================================


-- ============================================================
-- 1. PERSON / ACCOUNT MEMBERSHIP
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsmedi_person_accounts (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.whatsmedi_persons(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(account_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_person_accounts_account
  ON public.whatsmedi_person_accounts(account_id);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_person_accounts_person
  ON public.whatsmedi_person_accounts(person_id);


-- ============================================================
-- 2. SHARED CLINICAL ENUMS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'whatsmedi_health_source'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.whatsmedi_health_source AS ENUM (
      'self_reported',
      'provider_entered',
      'imported',
      'document_extracted',
      'system_recorded',
      'ai_suggested'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'whatsmedi_verification_status'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.whatsmedi_verification_status AS ENUM (
      'unverified',
      'verified',
      'rejected',
      'superseded'
    );
  END IF;
END
$$;


-- ============================================================
-- 3. CONDITIONS / PROBLEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsmedi_health_conditions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL,
  person_id UUID NOT NULL,

  display_text TEXT NOT NULL,

  code_system TEXT,
  code TEXT,

  status TEXT NOT NULL DEFAULT 'suspected'
    CHECK (status IN ('active', 'resolved', 'inactive', 'suspected')),

  onset_date DATE,
  resolved_date DATE,

  source public.whatsmedi_health_source NOT NULL,
  source_reference TEXT,

  verification_status public.whatsmedi_verification_status NOT NULL
    DEFAULT 'unverified',

  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_health_conditions_person_account
    FOREIGN KEY (account_id, person_id)
    REFERENCES public.whatsmedi_person_accounts(account_id, person_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_health_conditions_dates
    CHECK (
      resolved_date IS NULL
      OR onset_date IS NULL
      OR resolved_date >= onset_date
    )
);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_conditions_person
  ON public.whatsmedi_health_conditions(account_id, person_id);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_conditions_status
  ON public.whatsmedi_health_conditions(account_id, person_id, status);


-- ============================================================
-- 4. MEDICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsmedi_health_medications (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL,
  person_id UUID NOT NULL,

  medication_name TEXT NOT NULL,
  strength TEXT,
  dose TEXT,
  route TEXT,
  frequency TEXT,

  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('active', 'stopped', 'completed', 'planned')),

  start_date DATE,
  end_date DATE,

  code_system TEXT,
  code TEXT,

  source public.whatsmedi_health_source NOT NULL,
  source_reference TEXT,

  verification_status public.whatsmedi_verification_status NOT NULL
    DEFAULT 'unverified',

  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_health_medications_person_account
    FOREIGN KEY (account_id, person_id)
    REFERENCES public.whatsmedi_person_accounts(account_id, person_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_health_medications_dates
    CHECK (
      end_date IS NULL
      OR start_date IS NULL
      OR end_date >= start_date
    )
);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_medications_person
  ON public.whatsmedi_health_medications(account_id, person_id);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_medications_status
  ON public.whatsmedi_health_medications(account_id, person_id, status);


-- ============================================================
-- 5. ALLERGIES / INTOLERANCES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsmedi_health_allergies (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL,
  person_id UUID NOT NULL,

  allergen TEXT NOT NULL,
  reaction TEXT,
  severity TEXT,

  status TEXT NOT NULL DEFAULT 'uncertain'
    CHECK (status IN ('active', 'resolved', 'uncertain')),

  code_system TEXT,
  code TEXT,

  source public.whatsmedi_health_source NOT NULL,
  source_reference TEXT,

  verification_status public.whatsmedi_verification_status NOT NULL
    DEFAULT 'unverified',

  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_health_allergies_person_account
    FOREIGN KEY (account_id, person_id)
    REFERENCES public.whatsmedi_person_accounts(account_id, person_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_allergies_person
  ON public.whatsmedi_health_allergies(account_id, person_id);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_allergies_status
  ON public.whatsmedi_health_allergies(account_id, person_id, status);


-- ============================================================
-- 6. OBSERVATIONS / MEASUREMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsmedi_health_observations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL,
  person_id UUID NOT NULL,

  display_text TEXT NOT NULL,

  code_system TEXT,
  code TEXT,

  value_numeric NUMERIC,
  value_text TEXT,
  unit TEXT,

  reference_low NUMERIC,
  reference_high NUMERIC,

  interpretation TEXT,

  source public.whatsmedi_health_source NOT NULL,
  source_reference TEXT,

  verification_status public.whatsmedi_verification_status NOT NULL
    DEFAULT 'unverified',

  recorded_by UUID,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_health_observations_person_account
    FOREIGN KEY (account_id, person_id)
    REFERENCES public.whatsmedi_person_accounts(account_id, person_id),

  CONSTRAINT chk_health_observations_value
    CHECK (
      value_numeric IS NOT NULL
      OR value_text IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_observations_person
  ON public.whatsmedi_health_observations(account_id, person_id);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_observations_code
  ON public.whatsmedi_health_observations(account_id, code_system, code);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_observations_measured_at
  ON public.whatsmedi_health_observations(account_id, person_id, measured_at DESC);


-- ============================================================
-- 7. ENCOUNTERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsmedi_health_encounters (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL,
  person_id UUID NOT NULL,

  encounter_type TEXT NOT NULL,
  title TEXT,
  description TEXT,

  provider_name TEXT,
  facility_name TEXT,

  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),

  source public.whatsmedi_health_source NOT NULL,
  source_reference TEXT,

  verification_status public.whatsmedi_verification_status NOT NULL
    DEFAULT 'unverified',

  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_health_encounters_person_account
    FOREIGN KEY (account_id, person_id)
    REFERENCES public.whatsmedi_person_accounts(account_id, person_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_encounters_person
  ON public.whatsmedi_health_encounters(account_id, person_id, occurred_at DESC);


-- ============================================================
-- 8. PROCEDURES / INTERVENTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsmedi_health_procedures (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL,
  person_id UUID NOT NULL,

  procedure_name TEXT NOT NULL,
  description TEXT,

  code_system TEXT,
  code TEXT,

  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),

  performed_by TEXT,
  facility_name TEXT,

  source public.whatsmedi_health_source NOT NULL,
  source_reference TEXT,

  verification_status public.whatsmedi_verification_status NOT NULL
    DEFAULT 'unverified',

  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_health_procedures_person_account
    FOREIGN KEY (account_id, person_id)
    REFERENCES public.whatsmedi_person_accounts(account_id, person_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_procedures_person
  ON public.whatsmedi_health_procedures(account_id, person_id, occurred_at DESC);


-- ============================================================
-- 9. DOCUMENTS / REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsmedi_health_documents (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL,
  person_id UUID NOT NULL,

  document_type TEXT NOT NULL,
  title TEXT,

  storage_reference TEXT,
  mime_type TEXT,

  document_date TIMESTAMPTZ,
  source public.whatsmedi_health_source NOT NULL,
  source_reference TEXT,

  extraction_status TEXT NOT NULL DEFAULT 'not_processed'
    CHECK (
      extraction_status IN (
        'not_processed',
        'processing',
        'completed',
        'failed'
      )
    ),

  verification_status public.whatsmedi_verification_status NOT NULL
    DEFAULT 'unverified',

  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_health_documents_person_account
    FOREIGN KEY (account_id, person_id)
    REFERENCES public.whatsmedi_person_accounts(account_id, person_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_documents_person
  ON public.whatsmedi_health_documents(account_id, person_id, document_date DESC);


-- ============================================================
-- 10. HEALTH EVENTS / TIMELINE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsmedi_health_events (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL,
  person_id UUID NOT NULL,

  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  source public.whatsmedi_health_source NOT NULL,
  source_reference TEXT,

  verification_status public.whatsmedi_verification_status NOT NULL
    DEFAULT 'unverified',

  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_health_events_person_account
    FOREIGN KEY (account_id, person_id)
    REFERENCES public.whatsmedi_person_accounts(account_id, person_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_events_person
  ON public.whatsmedi_health_events(account_id, person_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_health_events_type
  ON public.whatsmedi_health_events(account_id, person_id, event_type);


-- ============================================================
-- 11. UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.whatsmedi_healthos_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;


DROP TRIGGER IF EXISTS trg_whatsmedi_person_accounts_updated_at
  ON public.whatsmedi_person_accounts;

CREATE TRIGGER trg_whatsmedi_person_accounts_updated_at
  BEFORE UPDATE ON public.whatsmedi_person_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsmedi_healthos_set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsmedi_health_conditions_updated_at
  ON public.whatsmedi_health_conditions;

CREATE TRIGGER trg_whatsmedi_health_conditions_updated_at
  BEFORE UPDATE ON public.whatsmedi_health_conditions
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsmedi_healthos_set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsmedi_health_medications_updated_at
  ON public.whatsmedi_health_medications;

CREATE TRIGGER trg_whatsmedi_health_medications_updated_at
  BEFORE UPDATE ON public.whatsmedi_health_medications
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsmedi_healthos_set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsmedi_health_allergies_updated_at
  ON public.whatsmedi_health_allergies;

CREATE TRIGGER trg_whatsmedi_health_allergies_updated_at
  BEFORE UPDATE ON public.whatsmedi_health_allergies
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsmedi_healthos_set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsmedi_health_observations_updated_at
  ON public.whatsmedi_health_observations;

CREATE TRIGGER trg_whatsmedi_health_observations_updated_at
  BEFORE UPDATE ON public.whatsmedi_health_observations
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsmedi_healthos_set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsmedi_health_encounters_updated_at
  ON public.whatsmedi_health_encounters;

CREATE TRIGGER trg_whatsmedi_health_encounters_updated_at
  BEFORE UPDATE ON public.whatsmedi_health_encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsmedi_healthos_set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsmedi_health_procedures_updated_at
  ON public.whatsmedi_health_procedures;

CREATE TRIGGER trg_whatsmedi_health_procedures_updated_at
  BEFORE UPDATE ON public.whatsmedi_health_procedures
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsmedi_healthos_set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsmedi_health_documents_updated_at
  ON public.whatsmedi_health_documents;

CREATE TRIGGER trg_whatsmedi_health_documents_updated_at
  BEFORE UPDATE ON public.whatsmedi_health_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsmedi_healthos_set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsmedi_health_events_updated_at
  ON public.whatsmedi_health_events;

CREATE TRIGGER trg_whatsmedi_health_events_updated_at
  BEFORE UPDATE ON public.whatsmedi_health_events
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsmedi_healthos_set_updated_at();


-- ============================================================
-- 12. ROW LEVEL SECURITY
--
-- HealthOS clinical data is privacy-sensitive.
-- Phase 1 does not expose broad client-side CRUD policies.
-- Service-controlled access is intentional until the Health
-- Context / authorization layer is implemented.
-- ============================================================

ALTER TABLE public.whatsmedi_person_accounts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsmedi_health_conditions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsmedi_health_medications
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsmedi_health_allergies
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsmedi_health_observations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsmedi_health_encounters
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsmedi_health_procedures
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsmedi_health_documents
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsmedi_health_events
  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 13. COMMENTS
-- ============================================================

COMMENT ON TABLE public.whatsmedi_person_accounts IS
  'Account-scoped relationship between a WhatsMedi Person and an account. Clinical records reference this boundary.';

COMMENT ON TABLE public.whatsmedi_health_conditions IS
  'Structured health conditions/problems. This is not a full EHR diagnosis system.';

COMMENT ON TABLE public.whatsmedi_health_medications IS
  'Medication history and current/planned medication state. Clinical verification is explicit.';

COMMENT ON TABLE public.whatsmedi_health_allergies IS
  'Allergy/intolerance information with explicit verification state.';

COMMENT ON TABLE public.whatsmedi_health_observations IS
  'Clinical observations and measurements. Designed to accept standardized terminology such as LOINC without requiring it.';

COMMENT ON TABLE public.whatsmedi_health_encounters IS
  'Healthcare encounters and consultations associated with a person.';

COMMENT ON TABLE public.whatsmedi_health_procedures IS
  'Procedures and interventions associated with a person.';

COMMENT ON TABLE public.whatsmedi_health_documents IS
  'Clinical documents/reports and their processing/provenance metadata.';

COMMENT ON TABLE public.whatsmedi_health_events IS
  'Chronological health timeline events.';

COMMENT ON COLUMN public.whatsmedi_health_conditions.source IS
  'Provenance of the health information. AI suggestions must not be treated as verified clinical facts.';

COMMENT ON COLUMN public.whatsmedi_health_observations.code_system IS
  'Terminology namespace, for example LOINC, when a standardized code is available.';

COMMENT ON COLUMN public.whatsmedi_health_conditions.code_system IS
  'Terminology namespace, for example ICD-11, when a standardized code is available.';

COMMENT ON COLUMN public.whatsmedi_health_documents.extraction_status IS
  'Controls document extraction lifecycle; extracted information remains subject to provenance and verification.';

