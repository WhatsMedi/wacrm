-- ============================================================
-- WhatsMedi actor -> person authorization
-- Migration 047
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsmedi_person_authorizations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  account_id UUID NOT NULL,
  person_id UUID NOT NULL,

  actor_type TEXT NOT NULL
    CHECK (
      actor_type IN (
        'patient',
        'caregiver',
        'provider',
        'agent',
        'system'
      )
    ),

  actor_id TEXT NOT NULL
    CHECK (length(trim(actor_id)) > 0),

  purpose TEXT NOT NULL
    CHECK (
      purpose IN (
        'clinical_conversation',
        'health_assessment',
        'medication_action',
        'appointment_booking',
        'diagnostic_action',
        'care_coordination',
        'follow_up'
      )
    ),

  relationship TEXT NOT NULL
    CHECK (length(trim(relationship)) > 0),

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (
      status IN (
        'active',
        'revoked',
        'expired'
      )
    ),

  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_whatsmedi_person_authorizations_person_account
    FOREIGN KEY (account_id, person_id)
    REFERENCES public.whatsmedi_person_accounts(account_id, person_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_whatsmedi_person_authorizations_expiry
    CHECK (
      expires_at IS NULL
      OR expires_at > granted_at
    ),

  CONSTRAINT uq_whatsmedi_person_authorizations_scope
    UNIQUE (
      account_id,
      person_id,
      actor_type,
      actor_id,
      purpose
    )
);

CREATE INDEX IF NOT EXISTS
  idx_whatsmedi_person_authorizations_lookup
ON public.whatsmedi_person_authorizations(
  account_id,
  person_id,
  actor_type,
  actor_id,
  purpose,
  status
);

CREATE INDEX IF NOT EXISTS
  idx_whatsmedi_person_authorizations_actor
ON public.whatsmedi_person_authorizations(
  account_id,
  actor_type,
  actor_id,
  status
);

ALTER TABLE public.whatsmedi_person_authorizations
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION
public.whatsmedi_person_authorizations_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION
public.whatsmedi_person_authorizations_set_updated_at()
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.whatsmedi_person_authorizations_set_updated_at()
FROM anon;

REVOKE ALL ON FUNCTION
public.whatsmedi_person_authorizations_set_updated_at()
FROM authenticated;

GRANT EXECUTE ON FUNCTION
public.whatsmedi_person_authorizations_set_updated_at()
TO service_role;

DROP TRIGGER IF EXISTS
trg_whatsmedi_person_authorizations_updated_at
ON public.whatsmedi_person_authorizations;

CREATE TRIGGER
trg_whatsmedi_person_authorizations_updated_at
BEFORE UPDATE
ON public.whatsmedi_person_authorizations
FOR EACH ROW
EXECUTE FUNCTION
public.whatsmedi_person_authorizations_set_updated_at();

COMMENT ON TABLE
public.whatsmedi_person_authorizations IS
'Explicit account/person/actor/purpose grants used by the WhatsMedi Health Context authorization boundary. Patient self-access is handled by application policy; non-patient access requires an active grant.';

COMMENT ON COLUMN
public.whatsmedi_person_authorizations.actor_id IS
'Canonical identifier of the actor within the actor-type namespace. Authentication and identity verification occur outside this authorization record.';

COMMENT ON COLUMN
public.whatsmedi_person_authorizations.purpose IS
'Health Context purpose for which this actor is authorized. Grants are purpose-specific and do not implicitly authorize other purposes.';
