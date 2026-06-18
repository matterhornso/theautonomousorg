-- 012_company_id_indexes.sql
-- Add indexes on company_id columns that lacked them. These speed up the
-- per-tenant `WHERE company_id = ...` filters used throughout the app and the
-- RLS policy checks after the app_user cutover (migration 011).
--
-- SAFE TO APPLY: additive, idempotent (IF NOT EXISTS). No data change.

CREATE INDEX IF NOT EXISTS idx_api_keys_company_id        ON api_keys (company_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_company_id    ON file_uploads (company_id);
CREATE INDEX IF NOT EXISTS idx_messaging_users_company_id ON messaging_users (company_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_company_id        ON webhooks (company_id);
