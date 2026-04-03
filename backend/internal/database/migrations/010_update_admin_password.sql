-- Update admin password
UPDATE admins
SET password_hash = '$2a$10$oSLAMDApfw955XpDjSJu5.yVS4gIkNXBlq6VBnex/HH6fhtzj135m',
    updated_at = NOW()
WHERE email = 'admin@secondmission.com';
