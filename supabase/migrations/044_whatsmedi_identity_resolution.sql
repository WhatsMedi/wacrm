-- ============================================================
-- WhatsMedi identity resolution
-- Migration 044
--
-- Provisioning a Person, WhatsApp identity, and WACRM mapping
-- must be one transaction. This RPC is service-role only.
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_whatsmedi_identity(
  p_account_id UUID,
  p_wacrm_contact_id UUID,
  p_phone_number TEXT,
  p_whatsapp_user_id TEXT,
  p_display_name TEXT,
  p_source public.whatsmedi_identity_source
)
RETURNS TABLE (
  person_id UUID,
  person_display_name TEXT,
  person_created_at TIMESTAMPTZ,
  person_updated_at TIMESTAMPTZ,
  identity_id UUID,
  identity_account_id UUID,
  identity_person_id UUID,
  identity_phone_number TEXT,
  identity_whatsapp_user_id TEXT,
  identity_status public.whatsmedi_identity_status,
  identity_source public.whatsmedi_identity_source,
  identity_created_at TIMESTAMPTZ,
  identity_updated_at TIMESTAMPTZ,
  mapping_id UUID,
  mapping_account_id UUID,
  mapping_wacrm_contact_id UUID,
  mapping_person_id UUID,
  mapping_whatsapp_identity_id UUID,
  mapping_created_at TIMESTAMPTZ,
  mapping_updated_at TIMESTAMPTZ,
  is_new_person BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_person public.whatsmedi_persons%ROWTYPE;
  v_identity public.whatsmedi_whatsapp_identities%ROWTYPE;
  v_identity_by_phone public.whatsmedi_whatsapp_identities%ROWTYPE;
  v_identity_by_bsuid public.whatsmedi_whatsapp_identities%ROWTYPE;
  v_mapping public.whatsmedi_wacrm_contact_mappings%ROWTYPE;
  v_created_person BOOLEAN := false;
  v_new_person_id UUID;
  v_phone_lock BIGINT;
  v_bsuid_lock BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'WhatsMedi identity resolution requires the service role'
      USING ERRCODE = '42501';
  END IF;

  p_phone_number := regexp_replace(coalesce(p_phone_number, ''), '[^0-9]', '', 'g');
  p_whatsapp_user_id := nullif(btrim(p_whatsapp_user_id), '');

  IF p_source IS NULL THEN
    RAISE EXCEPTION 'WhatsMedi identity source is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_phone_number = '' AND p_whatsapp_user_id IS NULL THEN
    RAISE EXCEPTION 'WhatsMedi identity requires a phone number or BSUID'
      USING ERRCODE = '22023';
  END IF;

  IF p_whatsapp_user_id IS NOT NULL
     AND p_whatsapp_user_id !~ '^[A-Za-z]{2}\.(ENT\.)?[A-Za-z0-9]{4,}$' THEN
    RAISE EXCEPTION 'WhatsApp user ID must be a valid BSUID'
      USING ERRCODE = '22023';
  END IF;

  -- Lock every supplied account-scoped key, in a stable order. Locking the
  -- combined pair serializes only identical requests; it permits overlapping
  -- requests such as (phone A, BSUID B) and (phone A, BSUID C) to race.
  -- The unique indexes remain the final integrity backstop.
  IF p_phone_number <> '' THEN
    v_phone_lock := hashtextextended(
      'whatsmedi:phone:' || p_account_id::text || ':' || p_phone_number,
      0
    );
  END IF;
  IF p_whatsapp_user_id IS NOT NULL THEN
    v_bsuid_lock := hashtextextended(
      'whatsmedi:bsuid:' || p_account_id::text || ':' || p_whatsapp_user_id,
      0
    );
  END IF;
  IF v_phone_lock IS NOT NULL AND v_bsuid_lock IS NOT NULL THEN
    IF v_phone_lock < v_bsuid_lock THEN
      PERFORM pg_advisory_xact_lock(v_phone_lock);
      PERFORM pg_advisory_xact_lock(v_bsuid_lock);
    ELSE
      PERFORM pg_advisory_xact_lock(v_bsuid_lock);
      PERFORM pg_advisory_xact_lock(v_phone_lock);
    END IF;
  ELSIF v_phone_lock IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(v_phone_lock);
  ELSE
    PERFORM pg_advisory_xact_lock(v_bsuid_lock);
  END IF;

  -- A completed resolution for this WACRM contact always wins.
  SELECT m.* INTO v_mapping
  FROM public.whatsmedi_wacrm_contact_mappings m
  WHERE m.account_id = p_account_id
    AND m.wacrm_contact_id = p_wacrm_contact_id
  FOR UPDATE OF m;

  IF FOUND THEN
    SELECT * INTO v_identity
    FROM public.whatsmedi_whatsapp_identities
    WHERE id = v_mapping.whatsapp_identity_id
      AND account_id = p_account_id
    FOR UPDATE;

    SELECT * INTO v_person
    FROM public.whatsmedi_persons
    WHERE id = v_mapping.person_id;

    IF v_identity.id IS NULL OR v_person.id IS NULL THEN
      RAISE EXCEPTION
        'WhatsMedi mapping is inconsistent for contact %',
        p_wacrm_contact_id;
    END IF;

    IF p_phone_number <> '' AND v_identity.phone_number NOT IN ('', p_phone_number) THEN
      RAISE EXCEPTION 'Phone number does not match the existing WhatsMedi identity'
        USING ERRCODE = '23505';
    END IF;
    IF p_whatsapp_user_id IS NOT NULL
       AND v_identity.whatsapp_user_id IS NOT NULL
       AND v_identity.whatsapp_user_id <> p_whatsapp_user_id THEN
      RAISE EXCEPTION 'BSUID does not match the existing WhatsMedi identity'
        USING ERRCODE = '23505';
    END IF;

    IF p_phone_number <> '' AND v_identity.phone_number = '' THEN
      SELECT * INTO v_identity_by_phone
      FROM public.whatsmedi_whatsapp_identities
      WHERE account_id = p_account_id
        AND phone_number = p_phone_number;

      IF v_identity_by_phone.id IS NOT NULL
         AND v_identity_by_phone.id <> v_identity.id THEN
        RAISE EXCEPTION 'Phone number belongs to another WhatsMedi identity'
          USING ERRCODE = '23505';
      END IF;

      UPDATE public.whatsmedi_whatsapp_identities
      SET phone_number = p_phone_number
      WHERE id = v_identity.id
        AND account_id = p_account_id
      RETURNING * INTO v_identity;
    END IF;

    IF p_whatsapp_user_id IS NOT NULL
       AND v_identity.whatsapp_user_id IS NULL THEN
      SELECT * INTO v_identity_by_bsuid
      FROM public.whatsmedi_whatsapp_identities
      WHERE account_id = p_account_id
        AND whatsapp_user_id = p_whatsapp_user_id;

      IF v_identity_by_bsuid.id IS NOT NULL
         AND v_identity_by_bsuid.id <> v_identity.id THEN
        RAISE EXCEPTION 'BSUID belongs to another WhatsMedi identity'
          USING ERRCODE = '23505';
      END IF;

      UPDATE public.whatsmedi_whatsapp_identities
      SET whatsapp_user_id = p_whatsapp_user_id
      WHERE id = v_identity.id
        AND account_id = p_account_id
      RETURNING * INTO v_identity;
    END IF;

  ELSE
    IF p_whatsapp_user_id IS NOT NULL THEN
      SELECT * INTO v_identity_by_bsuid
      FROM public.whatsmedi_whatsapp_identities
      WHERE account_id = p_account_id
        AND whatsapp_user_id = p_whatsapp_user_id;
    END IF;

    IF p_phone_number <> '' THEN
      SELECT * INTO v_identity_by_phone
      FROM public.whatsmedi_whatsapp_identities
      WHERE account_id = p_account_id
        AND phone_number = p_phone_number;
    END IF;

    IF v_identity_by_bsuid.id IS NOT NULL
       AND v_identity_by_phone.id IS NOT NULL
       AND v_identity_by_bsuid.id <> v_identity_by_phone.id THEN
      RAISE EXCEPTION
        'BSUID and phone number belong to different WhatsMedi identities'
        USING ERRCODE = '23505';
    END IF;

    IF v_identity_by_bsuid.id IS NOT NULL THEN
      v_identity := v_identity_by_bsuid;
    ELSIF v_identity_by_phone.id IS NOT NULL THEN
      v_identity := v_identity_by_phone;
    END IF;

    IF v_identity.id IS NULL THEN
      INSERT INTO public.whatsmedi_persons (display_name)
      VALUES (nullif(btrim(p_display_name), ''))
      RETURNING * INTO v_person;

      v_new_person_id := v_person.id;

      INSERT INTO public.whatsmedi_whatsapp_identities (
        account_id,
        person_id,
        phone_number,
        whatsapp_user_id,
        status,
        source
      )
      VALUES (
        p_account_id,
        v_person.id,
        p_phone_number,
        p_whatsapp_user_id,
        'active',
        p_source
      )
      ON CONFLICT DO NOTHING
      RETURNING * INTO v_identity;

      -- Another transaction may have won the identity unique constraint.
      -- Remove this provisional person before reusing the winner.
      IF v_identity.id IS NULL THEN
        DELETE FROM public.whatsmedi_persons
        WHERE id = v_new_person_id;

        IF p_whatsapp_user_id IS NOT NULL THEN
          SELECT * INTO v_identity_by_bsuid
          FROM public.whatsmedi_whatsapp_identities
          WHERE account_id = p_account_id
            AND whatsapp_user_id = p_whatsapp_user_id;
        END IF;

        IF p_phone_number <> '' THEN
          SELECT * INTO v_identity_by_phone
          FROM public.whatsmedi_whatsapp_identities
          WHERE account_id = p_account_id
            AND phone_number = p_phone_number;
        END IF;

        IF v_identity_by_bsuid.id IS NOT NULL
           AND v_identity_by_phone.id IS NOT NULL
           AND v_identity_by_bsuid.id <> v_identity_by_phone.id THEN
          RAISE EXCEPTION
            'BSUID and phone number belong to different WhatsMedi identities'
            USING ERRCODE = '23505';
        END IF;

        IF v_identity_by_bsuid.id IS NOT NULL THEN
          v_identity := v_identity_by_bsuid;
        ELSIF v_identity_by_phone.id IS NOT NULL THEN
          v_identity := v_identity_by_phone;
        END IF;
      ELSE
        v_created_person := true;
      END IF;
    END IF;

    IF v_identity.id IS NULL THEN
      RAISE EXCEPTION 'Unable to resolve WhatsMedi identity';
    END IF;

    IF p_phone_number <> '' AND v_identity.phone_number = '' THEN
      UPDATE public.whatsmedi_whatsapp_identities
      SET phone_number = p_phone_number
      WHERE id = v_identity.id
        AND account_id = p_account_id
      RETURNING * INTO v_identity;
    END IF;

    IF p_whatsapp_user_id IS NOT NULL
       AND v_identity.whatsapp_user_id IS NULL THEN
      UPDATE public.whatsmedi_whatsapp_identities
      SET whatsapp_user_id = p_whatsapp_user_id
      WHERE id = v_identity.id
        AND account_id = p_account_id
      RETURNING * INTO v_identity;
    END IF;

    SELECT * INTO v_person
    FROM public.whatsmedi_persons
    WHERE id = v_identity.person_id;

    -- Migration 043 permits only one WACRM contact per WhatsApp identity.
    -- Same-contact races are idempotent; a different contact fails clearly.
    INSERT INTO public.whatsmedi_wacrm_contact_mappings (
      account_id,
      wacrm_contact_id,
      person_id,
      whatsapp_identity_id
    )
    VALUES (
      p_account_id,
      p_wacrm_contact_id,
      v_identity.person_id,
      v_identity.id
    )
    ON CONFLICT DO NOTHING
    RETURNING * INTO v_mapping;

    IF v_mapping.id IS NULL THEN
      SELECT * INTO v_mapping
      FROM public.whatsmedi_wacrm_contact_mappings
      WHERE account_id = p_account_id
        AND wacrm_contact_id = p_wacrm_contact_id;

      IF v_mapping.id IS NULL THEN
        RAISE EXCEPTION
          'WhatsApp identity is already mapped to another WACRM contact'
          USING ERRCODE = '23505';
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    v_person.id,
    v_person.display_name,
    v_person.created_at,
    v_person.updated_at,
    v_identity.id,
    v_identity.account_id,
    v_identity.person_id,
    v_identity.phone_number,
    v_identity.whatsapp_user_id,
    v_identity.status,
    v_identity.source,
    v_identity.created_at,
    v_identity.updated_at,
    v_mapping.id,
    v_mapping.account_id,
    v_mapping.wacrm_contact_id,
    v_mapping.person_id,
    v_mapping.whatsapp_identity_id,
    v_mapping.created_at,
    v_mapping.updated_at,
    v_created_person;
END;
$$;

-- This function is intentionally service-role only. Its body qualifies all
-- non-catalog objects and excludes `public` from search_path so caller-owned
-- objects cannot be resolved with definer privileges.
ALTER FUNCTION public.resolve_whatsmedi_identity(
  UUID, UUID, TEXT, TEXT, TEXT, public.whatsmedi_identity_source
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.resolve_whatsmedi_identity(
  UUID, UUID, TEXT, TEXT, TEXT, public.whatsmedi_identity_source
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_whatsmedi_identity(
  UUID, UUID, TEXT, TEXT, TEXT, public.whatsmedi_identity_source
) TO service_role;
