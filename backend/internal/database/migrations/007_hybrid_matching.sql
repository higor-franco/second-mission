-- 007_hybrid_matching.sql
-- Add match_details JSONB to veteran_applications for hybrid score breakdowns
-- and add tasks to job_listings seed data for richer matching

ALTER TABLE veteran_applications ADD COLUMN IF NOT EXISTS match_details JSONB;

-- Backfill tasks and mos_codes_preferred on seed listings that have empty arrays
-- NOV listings
UPDATE job_listings SET
    tasks = ARRAY['Fleet coordination', 'Maintenance scheduling', 'Driver assignments', 'DOT compliance', 'Equipment delivery logistics'],
    mos_codes_preferred = ARRAY['88M', '92Y']
WHERE title = 'Fleet Operations Manager' AND tasks = '{}';

UPDATE job_listings SET
    tasks = ARRAY['Hydraulic system repair', 'Electrical troubleshooting', 'Preventive maintenance', 'Equipment diagnostics', 'Welding'],
    mos_codes_preferred = ARRAY['91B', '94E', '15T']
WHERE title = 'Field Service Mechanic — Drilling Equipment' AND tasks = '{}';

UPDATE job_listings SET
    tasks = ARRAY['Team supervision', 'Inventory management', 'Shipment coordination', 'Safety compliance', 'SAP data entry'],
    mos_codes_preferred = ARRAY['92Y', '88M']
WHERE title = 'Warehouse Operations Supervisor' AND tasks = '{}';

UPDATE job_listings SET
    tasks = ARRAY['Equipment transport', 'DOT log maintenance', 'Pre-trip inspections', 'Route planning', 'Load securing'],
    mos_codes_preferred = ARRAY['88M']
WHERE title = 'CDL Driver — Equipment Transport' AND tasks = '{}';

-- GE Vernova listings
UPDATE job_listings SET
    tasks = ARRAY['Turbine maintenance', 'Electrical diagnostics', 'Mechanical repair', 'Safety inspections', 'Heights work'],
    mos_codes_preferred = ARRAY['15T', '91B', '94E']
WHERE title = 'Wind Turbine Service Technician' AND tasks = '{}';

UPDATE job_listings SET
    tasks = ARRAY['Safety program development', 'Incident investigation', 'OSHA compliance training', 'Safety audits', 'EHS reporting'],
    mos_codes_preferred = ARRAY['74D', '68W']
WHERE title = 'EHS Specialist — Wind Operations' AND tasks = '{}';

UPDATE job_listings SET
    tasks = ARRAY['Team leadership', 'Maintenance planning', 'Parts inventory', 'Technical troubleshooting', 'Uptime monitoring'],
    mos_codes_preferred = ARRAY['91B', '15T', '94E']
WHERE title = 'Maintenance Team Lead — Renewables' AND tasks = '{}';

-- KBR listings
UPDATE job_listings SET
    tasks = ARRAY['Project management', 'Subcontractor coordination', 'Schedule management', 'Compliance verification', 'Budget tracking'],
    mos_codes_preferred = ARRAY['12B']
WHERE title = 'Construction Project Manager — Government Facilities' AND tasks = '{}';

UPDATE job_listings SET
    tasks = ARRAY['Crew supervision', 'Work assignments', 'Safety enforcement', 'Materials coordination', 'Progress reporting'],
    mos_codes_preferred = ARRAY['12B', '11B']
WHERE title = 'General Construction Foreman' AND tasks = '{}';

-- Fluor listings
UPDATE job_listings SET
    tasks = ARRAY['Pipefitting', 'Blueprint reading', 'Industrial piping assembly', 'Safety compliance', 'Pressure testing'],
    mos_codes_preferred = ARRAY['12B', '91B']
WHERE title LIKE '%Pipefitter%' AND tasks = '{}';

-- XTO Energy listings
UPDATE job_listings SET
    tasks = ARRAY['Chemical plant operations', 'Process monitoring', 'Equipment operation', 'Safety protocols', 'Quality control'],
    mos_codes_preferred = ARRAY['74D', '92Y']
WHERE title LIKE '%Process Operator%' AND tasks = '{}';

-- CenterPoint Energy listings
UPDATE job_listings SET
    tasks = ARRAY['Electrical systems', 'Utility maintenance', 'Grid operations', 'Safety compliance', 'Customer service'],
    mos_codes_preferred = ARRAY['94E', '25B']
WHERE title LIKE '%Utility%' OR (title LIKE '%Electrical%' AND tasks = '{}');

-- Saia listings
UPDATE job_listings SET
    tasks = ARRAY['Route management', 'Long-haul driving', 'Load inspection', 'DOT compliance', 'Delivery coordination'],
    mos_codes_preferred = ARRAY['88M']
WHERE title LIKE '%Driver%' AND employer_id IN (SELECT id FROM employers WHERE company_name LIKE 'Saia%') AND tasks = '{}';

UPDATE job_listings SET
    tasks = ARRAY['Transportation planning', 'Route optimization', 'Carrier management', 'Cost analysis', 'Compliance oversight'],
    mos_codes_preferred = ARRAY['88M', '92Y']
WHERE title LIKE '%Logistics%' AND employer_id IN (SELECT id FROM employers WHERE company_name LIKE 'Saia%') AND tasks = '{}';

-- SunCoke listings
UPDATE job_listings SET
    tasks = ARRAY['Facility management', 'Vendor coordination', 'Maintenance oversight', 'Budget management', 'Regulatory compliance'],
    mos_codes_preferred = ARRAY['92Y', '12B']
WHERE title LIKE '%Facility%' AND tasks = '{}';

UPDATE job_listings SET
    tasks = ARRAY['Production supervision', 'Quality control', 'Team coordination', 'Safety enforcement', 'Process optimization'],
    mos_codes_preferred = ARRAY['11B', '92Y']
WHERE title LIKE '%Production%' AND tasks = '{}';

-- Update any remaining listings that still have empty tasks
UPDATE job_listings SET
    tasks = ARRAY['General operations', 'Safety compliance', 'Team coordination']
WHERE tasks = '{}';

UPDATE job_listings SET
    mos_codes_preferred = ARRAY['88M', '91B', '92Y', '12B']
WHERE mos_codes_preferred = '{}';
