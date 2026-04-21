-- 013_add_92a_and_demo_listing.sql
-- Add MOS 92A (Automated Logistical Specialist) to the catalog and create
-- a tightly-tuned NOV listing that will be the demo "wow match" when a
-- veteran uploads the Martinez sample DD-214.
--
-- 92A is a real, common Army MOS — automated supply chain operations,
-- warehouse management, property accountability, SAMS-E / PBUSE / GCSS-Army.
-- It belongs in the catalog regardless of the demo; the seed omitted it
-- only because the initial list focused on the 10 most-frequent codes from
-- the Fort Cavazos transition cohort.
--
-- All statements are idempotent so the migration stays safe on a fresh DB
-- and on an environment where a partial version already ran.

-- 1. Add the MOS code itself.
INSERT INTO mos_codes (code, title, branch, description)
VALUES (
    '92A',
    'Automated Logistical Specialist',
    'Army',
    'Supervises and performs management and warehousing functions pertaining to receipt, storage, and issue of repair parts and supplies. Operates the Standard Army Management Information Systems (SAMS-E, PBUSE, GCSS-Army).'
)
ON CONFLICT (code) DO NOTHING;

-- 2. Map 92A to five civilian roles that reflect what the MOS actually does
--    day-to-day — weighted so the top match is a strong 92 and the weakest
--    is still a believable 78. Each mapping carries transferable_skills that
--    feed the skills_overlap dimension of the hybrid matcher.
INSERT INTO mos_civilian_mappings (mos_code, civilian_role_id, match_score, transferable_skills)
SELECT '92A', cr.id, m.score, m.skills::text[]
FROM civilian_roles cr
JOIN LATERAL (VALUES
    ('11-3071.00', 92, ARRAY['inventory management','warehouse operations','supply chain planning','property accountability','SAP/ERP systems','team leadership','logistics coordination','SAMS-E/PBUSE/GCSS-Army']),
    ('53-1043.00', 88, ARRAY['warehouse operations','team supervision','materials handling','inventory accuracy','safety compliance','forklift coordination','shift planning']),
    ('43-5011.00', 82, ARRAY['shipment processing','cargo documentation','customs paperwork','carrier coordination','inventory tracking']),
    ('43-5061.00', 80, ARRAY['production planning','inventory control','expediting','vendor coordination','ERP data entry']),
    ('53-7051.00', 78, ARRAY['forklift operation','load handling','warehouse safety','inventory staging'])
) AS m(onet, score, skills) ON cr.onet_code = m.onet
ON CONFLICT (mos_code, civilian_role_id) DO NOTHING;

-- 3. Hand-crafted demo listing at NOV. Chooses the
--    "Transportation, Storage, and Distribution Manager" civilian role (the
--    strongest 92A match at 92) and explicitly lists 92A + 92Y + 88M in
--    `mos_codes_preferred` so the veteran-side matcher awards the +15%
--    MOS-preference bonus. WHERE-NOT-EXISTS keeps the insert idempotent
--    without requiring a unique constraint across (employer_id, title).
INSERT INTO job_listings (
    employer_id, civilian_role_id, title, description, requirements,
    location, salary_min, salary_max, employment_type, wotc_eligible,
    tasks, benefits, mos_codes_preferred
)
SELECT
    e.id,
    cr.id,
    'Logistics Operations Manager — Supply Chain Automation',
    'Lead NOV''s Houston distribution hub supply-chain automation team. Own end-to-end flow of drilling-equipment parts from supplier receipt through dispatch to Permian Basin field crews. Manage a group of 10 warehouse and logistics specialists. Drive SAP/ERP data accuracy, inventory turnover, and on-time fulfillment for 1,000+ active SKUs. Directly reports to the VP of Supply Chain. **Military logistics background strongly preferred — this role was built around the operational discipline Army 92A / 92Y / 88M veterans bring.**',
    ARRAY[
        '3+ years warehouse / supply-chain leadership (military experience counts)',
        'Working knowledge of SAP, Oracle, or equivalent ERP',
        'Inventory-accuracy and cycle-count discipline',
        'Team supervision — 5+ direct reports',
        'Comfortable with data-driven reporting (Excel / dashboards)'
    ],
    'Houston, TX',
    82000,
    112000,
    'full-time',
    true,
    ARRAY[
        'Own daily SAP/ERP inventory reconciliation',
        'Lead receiving, putaway, pick/pack/ship operations',
        'Coordinate outbound freight to Permian Basin field teams',
        'Drive 99%+ inventory accuracy and on-time-delivery KPIs',
        'Mentor and develop 10-person warehouse / logistics team',
        'Partner with procurement on supplier performance'
    ],
    ARRAY[
        'Full medical/dental/vision from day one',
        '401(k) with 5% company match',
        'Quarterly operational bonus',
        'Relocation assistance from Fort Cavazos',
        'Veteran ERG with mentorship pairing'
    ],
    ARRAY['92A','92Y','88M']
FROM employers e, civilian_roles cr
WHERE e.email = 'hiring@nov.com'
  AND cr.onet_code = '11-3071.00'
  AND NOT EXISTS (
      SELECT 1 FROM job_listings jl
      WHERE jl.employer_id = e.id
        AND jl.title = 'Logistics Operations Manager — Supply Chain Automation'
  );
