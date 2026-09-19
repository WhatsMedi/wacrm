-- ============================================================
-- WhatsMedi Identity Foundation
-- Migration 043
--
-- Purpose:
--   Establish the persistent identity boundary between WACRM
--   communication records and WhatsMedi's canonical Person model.
--
-- Phase-1 boundaries:
--   - No health data
--   - No family/dependent relationships
--   - No consent model
--   - No clinical data
--   - No agent state
--   - No transactions
--
-- WACRM remains the source of truth for communication/contact
-- records. WhatsMedi owns the canonical identity layer.
-- ============================================================


-- ============================================================
-- 1. ENUMS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'whatsmedi_identity_status'
  ) THEN
    CREATE TYPE whatsmedi_identity_status AS ENUM (
      'active',
      'blocked',
      'unlinked'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'whatsmedi_identity_source'
  ) THEN
    CREATE TYPE whatsmedi_identity_source AS ENUM (
      'whatsapp',
      'manual',
      'import'
    );
  END IF;
END
$$;


-- ============================================================
-- 2. CANONICAL PERSON
--
-- Person is the canonical WhatsMedi identity.
--
-- Phase 1 deliberately does not expose unrestricted cross-account
-- access. Account-scoped WhatsApp identities and WACRM mappings
-- provide the governed access boundary.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsmedi_persons (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsmedi_persons_created_at
  ON whatsmedi_persons(created_at);


-- ============================================================
-- 3. WHATSAPP IDENTITY
--
-- Account-scoped identity connecting WhatsApp to a Person.
--
-- whatsapp_user_id:
--   Preferred identity key when Meta provides a BSUID.
--
-- phone_number:
--   Normalized phone identity when available.
--
-- WhatsApp username is deliberately not stored as an identity key.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsmedi_whatsapp_identities (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  account_id UUID NOT NULL
    REFERENCES accounts(id) ON DELETE CASCADE,

  person_id UUID NOT NULL
    REFERENCES whatsmedi_persons(id) ON DELETE RESTRICT,

  phone_number TEXT NOT NULL,

  whatsapp_user_id TEXT,

  status whatsmedi_identity_status NOT NULL DEFAULT 'active',

  source whatsmedi_identity_source NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- One BSUID per account.
CREATE UNIQUE INDEX IF NOT EXISTS
  idx_whatsmedi_identity_account_wa_user_id
  ON whatsmedi_whatsapp_identities(account_id, whatsapp_user_id)
  WHERE whatsapp_user_id IS NOT NULL;


-- One phone identity per account when a phone is available.
-- Empty phone values are intentionally excluded.
CREATE UNIQUE INDEX IF NOT EXISTS
  idx_whatsmedi_identity_account_phone
  ON whatsmedi_whatsapp_identities(account_id, phone_number)
  WHERE phone_number <> '';


CREATE INDEX IF NOT EXISTS
  idx_whatsmedi_identity_account
  ON whatsmedi_whatsapp_identities(account_id);

CREATE INDEX IF NOT EXISTS
  idx_whatsmedi_identity_person
  ON whatsmedi_whatsapp_identities(person_id);


-- ============================================================
-- 4. ACCOUNT-CONSISTENCY SUPPORT KEYS
--
-- These composite unique indexes allow the mapping table below
-- to enforce that its account_id agrees with the referenced
-- WACRM Contact and WhatsMedi WhatsApp Identity.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_contacts_account_id_id
  ON contacts(account_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_whatsmedi_identity_account_id_id
  ON whatsmedi_whatsapp_identities(account_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_whatsmedi_identity_id_person_id
  ON whatsmedi_whatsapp_identities(id, person_id);


-- ============================================================
-- 5. WACRM CONTACT MAPPING
--
-- Explicit bridge:
--
--   WACRM Contact
--        ↓
--   WhatsMedi WhatsApp Identity
--        ↓
--   WhatsMedi Person
--
-- WACRM owns the Contact.
-- WhatsMedi owns the Person and WhatsApp Identity.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsmedi_wacrm_contact_mappings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  account_id UUID NOT NULL
    REFERENCES accounts(id) ON DELETE CASCADE,

  wacrm_contact_id UUID NOT NULL,

  person_id UUID NOT NULL
    REFERENCES whatsmedi_persons(id) ON DELETE RESTRICT,

  whatsapp_identity_id UUID NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 6. ACCOUNT-CONSISTENT FOREIGN KEYS
-- ============================================================

-- WACRM Contact must belong to the mapping's account.
ALTER TABLE whatsmedi_wacrm_contact_mappings
  ADD CONSTRAINT fk_whatsmedi_mapping_account_contact
  FOREIGN KEY (account_id, wacrm_contact_id)
  REFERENCES contacts(account_id, id)
  ON DELETE CASCADE;


-- WhatsMedi WhatsApp Identity must belong to the mapping's account.
ALTER TABLE whatsmedi_wacrm_contact_mappings
  ADD CONSTRAINT fk_whatsmedi_mapping_account_identity
  FOREIGN KEY (account_id, whatsapp_identity_id)
  REFERENCES whatsmedi_whatsapp_identities(account_id, id)
  ON DELETE CASCADE;


-- Mapping Person must be the same Person represented by the
-- WhatsApp Identity.
ALTER TABLE whatsmedi_wacrm_contact_mappings
  ADD CONSTRAINT fk_whatsmedi_mapping_identity_person
  FOREIGN KEY (whatsapp_identity_id, person_id)
  REFERENCES whatsmedi_whatsapp_identities(id, person_id)
  ON DELETE RESTRICT;


-- ============================================================
-- 7. MAPPING UNIQUENESS
-- ============================================================

-- One WACRM contact maps to at most one WhatsMedi identity
-- within an account.
CREATE UNIQUE INDEX IF NOT EXISTS
  idx_whatsmedi_mapping_account_wacrm_contact
  ON whatsmedi_wacrm_contact_mappings(account_id, wacrm_contact_id);


-- One WhatsMedi WhatsApp identity maps to at most one WACRM
-- contact within an account.
CREATE UNIQUE INDEX IF NOT EXISTS
  idx_whatsmedi_mapping_account_identity
  ON whatsmedi_wacrm_contact_mappings(account_id, whatsapp_identity_id);


CREATE INDEX IF NOT EXISTS
  idx_whatsmedi_mapping_account
  ON whatsmedi_wacrm_contact_mappings(account_id);

CREATE INDEX IF NOT EXISTS
  idx_whatsmedi_mapping_person
  ON whatsmedi_wacrm_contact_mappings(person_id);


-- ============================================================
-- 8. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at ON whatsmedi_persons;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON whatsmedi_persons
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS set_updated_at
  ON whatsmedi_whatsapp_identities;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON whatsmedi_whatsapp_identities
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS set_updated_at
  ON whatsmedi_wacrm_contact_mappings;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON whatsmedi_wacrm_contact_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 9. ROW LEVEL SECURITY
--
-- Identity provisioning is service-controlled in Phase 1.
--
-- No broad client policies are created yet. This prevents a
-- premature client-side identity API from becoming a privacy
-- boundary.
--
-- Future authenticated policies will use the existing WACRM
-- is_account_member(account_id, min_role) authorization model.
-- ============================================================

ALTER TABLE whatsmedi_persons
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE whatsmedi_whatsapp_identities
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE whatsmedi_wacrm_contact_mappings
  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 10. COMMENTS
-- ============================================================

COMMENT ON TABLE whatsmedi_persons IS
  'Canonical WhatsMedi person identity. Healthcare data is not stored here.';

COMMENT ON TABLE whatsmedi_whatsapp_identities IS
  'Account-scoped WhatsApp identity connecting a WhatsMedi Person to a WhatsApp channel.';

COMMENT ON TABLE whatsmedi_wacrm_contact_mappings IS
  'Explicit bridge between a WACRM Contact and the corresponding WhatsMedi identity.';

COMMENT ON COLUMN whatsmedi_whatsapp_identities.whatsapp_user_id IS
  'WhatsApp business-scoped user ID (BSUID). Preferred WhatsApp identity key when available.';

COMMENT ON COLUMN whatsmedi_whatsapp_identities.phone_number IS
  'Normalized WhatsApp phone identity when available. Empty string may be used for BSUID-only identities.';

COMMENT ON COLUMN whatsmedi_wacrm_contact_mappings.wacrm_contact_id IS
  'WACRM Contact primary key. WACRM remains the source of truth for the communication/contact record.';