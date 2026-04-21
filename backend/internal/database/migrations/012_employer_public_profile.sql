-- 012_employer_public_profile.sql
-- Extend the employers table with public-facing identity fields so veterans
-- can recognize and research a company before applying. Fields are nullable
-- or default-blank so existing employers stay valid without a backfill.
--
-- website_url / linkedin_url: canonical external links veterans open from the
-- company profile page.
-- company_size: free-form label ("500–1,000 employees") — no strict enum
-- because LinkedIn's bands move and we'd rather mirror what employers paste.
-- founded_year: integer; 0 is treated as "unknown" at the API layer so we
-- avoid a nullable int32 in sqlc/pgx.

ALTER TABLE employers
    ADD COLUMN IF NOT EXISTS website_url  TEXT    NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS linkedin_url TEXT    NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS company_size TEXT    NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS founded_year INTEGER NOT NULL DEFAULT 0;

-- Backfill the seeded demo employers so the veteran-side company profile
-- looks convincing during the Wharton AMP demo. Safe to re-run — the
-- update is a no-op when the values already match.
UPDATE employers SET
    website_url  = 'https://www.nov.com',
    linkedin_url = 'https://www.linkedin.com/company/nov-inc/',
    company_size = '10,001+ employees',
    founded_year = 1862
WHERE email = 'hiring@nov.com';

UPDATE employers SET
    website_url  = 'https://www.gevernova.com',
    linkedin_url = 'https://www.linkedin.com/company/gevernova/',
    company_size = '10,001+ employees',
    founded_year = 2024
WHERE email = 'careers@gerenova.com';

UPDATE employers SET
    website_url  = 'https://www.kbr.com',
    linkedin_url = 'https://www.linkedin.com/company/kbrinc/',
    company_size = '10,001+ employees',
    founded_year = 1901
WHERE email = 'talent@kbrgroup.com';

UPDATE employers SET
    website_url  = 'https://www.fluor.com',
    linkedin_url = 'https://www.linkedin.com/company/fluor-corporation/',
    company_size = '10,001+ employees',
    founded_year = 1912
WHERE email = 'recruit@fluor.com';

UPDATE employers SET
    website_url  = 'https://corporate.exxonmobil.com/locations/united-states/xto-energy',
    linkedin_url = 'https://www.linkedin.com/company/xto-energy/',
    company_size = '1,001–5,000 employees',
    founded_year = 1986
WHERE email = 'hr@xto-energy.com';

UPDATE employers SET
    website_url  = 'https://www.targaresources.com',
    linkedin_url = 'https://www.linkedin.com/company/targa-resources/',
    company_size = '1,001–5,000 employees',
    founded_year = 2005
WHERE email = 'careers@targa.com';

UPDATE employers SET
    website_url  = 'https://www.centerpointenergy.com',
    linkedin_url = 'https://www.linkedin.com/company/centerpoint-energy/',
    company_size = '10,001+ employees',
    founded_year = 1882
WHERE email = 'jobs@centerpointenergy.com';

UPDATE employers SET
    website_url  = 'https://www.mccarthy.com',
    linkedin_url = 'https://www.linkedin.com/company/mccarthy-building-companies/',
    company_size = '5,001–10,000 employees',
    founded_year = 1864
WHERE email = 'hiring@mccarthybuilding.com';

UPDATE employers SET
    website_url  = 'https://www.saia.com',
    linkedin_url = 'https://www.linkedin.com/company/saia-inc/',
    company_size = '10,001+ employees',
    founded_year = 1924
WHERE email = 'talent@saia.com';

UPDATE employers SET
    website_url  = 'https://www.suncoke.com',
    linkedin_url = 'https://www.linkedin.com/company/suncoke-energy/',
    company_size = '501–1,000 employees',
    founded_year = 1960
WHERE email = 'careers@suncoke.com';
