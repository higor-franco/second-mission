-- Fix the seeded admin password (bcrypt hash of 'admin123')
UPDATE admins
SET password_hash = '$2a$10$HBHn4qtrnUczkyUtyXd0mudVy5Ckma9i2WtwY8uwvptN77kAOR4qm',
    updated_at = NOW()
WHERE email = 'admin@secondmission.com';
