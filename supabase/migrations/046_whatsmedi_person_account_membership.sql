-- ============================================================
-- WhatsMedi Person / Account membership provisioning
-- Migration 046
--
-- Purpose:
--   Every successful WACRM -> WhatsMedi identity mapping must
--   establish the Person <-> Account membership required by
--   HealthOS / Health Context.
--
-- The trigger runs in the same database transaction as the
-- identity mapping insert, so a newly provisioned identity cannot
-- commit its mapping without its account membership.
-- ============================================================

CREATE OR REPLACE FUNCTION public.whatsmedi_ensure_person_account_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  INSERT INTO public.whatsmedi_person_accounts (
    account_id,
    person_id,
    status
  )
  VALUES (
    NEW.account_id,
    NEW.person_id,
    'active'
  )
  ON CONFLICT (account_id, person_id)
  DO UPDATE
    SET status = 'active',
        updated_at = NOW();

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.whatsmedi_ensure_person_account_membership()
  FROM PUBLIC;

REVOKE ALL ON FUNCTION public.whatsmedi_ensure_person_account_membership()
  FROM anon;

REVOKE ALL ON FUNCTION public.whatsmedi_ensure_person_account_membership()
  FROM authenticated;

GRANT EXECUTE ON FUNCTION public.whatsmedi_ensure_person_account_membership()
  TO service_role;

DROP TRIGGER IF EXISTS trg_whatsmedi_mapping_person_account_membership
  ON public.whatsmedi_wacrm_contact_mappings;

CREATE TRIGGER trg_whatsmedi_mapping_person_account_membership
AFTER INSERT ON public.whatsmedi_wacrm_contact_mappings
FOR EACH ROW
EXECUTE FUNCTION public.whatsmedi_ensure_person_account_membership();

INSERT INTO public.whatsmedi_person_accounts (
  account_id,
  person_id,
  status
)
SELECT DISTINCT
  m.account_id,
  m.person_id,
  'active'
FROM public.whatsmedi_wacrm_contact_mappings AS m
ON CONFLICT (account_id, person_id)
DO UPDATE
  SET status = 'active',
      updated_at = NOW();

COMMENT ON FUNCTION public.whatsmedi_ensure_person_account_membership()
IS 'Ensures a WACRM identity mapping has an active WhatsMedi Person/Account membership. Executed in the same transaction as mapping provisioning.';
