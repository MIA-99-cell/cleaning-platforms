-- Add admin approval token and super admin phone support
USE cleaning_platform;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS admin_approval_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS admin_approval_token_expires DATETIME;

ALTER TABLE super_admin
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
