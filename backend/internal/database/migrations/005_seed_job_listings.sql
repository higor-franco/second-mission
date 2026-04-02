-- 005_seed_job_listings.sql
-- Seed employer companies and realistic job listings for the Texas beachhead market

-- Seed anchor employers
INSERT INTO employers (email, company_name, contact_name, sector, location, description) VALUES
('hiring@nov.com', 'NOV (National Oilwell Varco)', 'Ryan Mitchell', 'Energy', 'Houston, TX', 'Global provider of equipment and components used in oil and gas drilling and production operations. Active SkillBridge partner.'),
('careers@gerenova.com', 'GE Vernova', 'Sarah Chen', 'Energy', 'Houston, TX', 'Leading manufacturer of wind turbines and renewable energy systems. Committed to hiring and training veterans for technical roles.'),
('talent@kbrgroup.com', 'KBR Inc.', 'Mike Torres', 'Construction', 'Houston, TX', 'Global engineering, construction, and services company supporting government and commercial clients.'),
('recruit@fluor.com', 'Fluor Corporation', 'Diana Reyes', 'Construction', 'Irving, TX', 'Global engineering and construction firm specializing in energy, chemicals, and infrastructure projects.'),
('hr@xto-energy.com', 'XTO Energy (ExxonMobil)', 'James Walker', 'Energy', 'Fort Worth, TX', 'Major oil and natural gas production subsidiary of ExxonMobil with operations across Texas.'),
('careers@targa.com', 'Targa Resources', 'Lisa Nguyen', 'Energy', 'Houston, TX', 'Leading midstream energy company gathering, compressing, treating, and processing natural gas.'),
('jobs@centerpointenergy.com', 'CenterPoint Energy', 'Robert Garcia', 'Energy', 'Houston, TX', 'Electric and natural gas utility serving the greater Houston metropolitan area.'),
('hiring@mccarthybuilding.com', 'McCarthy Building Companies', 'Chris Anderson', 'Construction', 'Dallas, TX', 'National commercial construction company with major projects across Texas.'),
('talent@saia.com', 'Saia Inc.', 'Patricia Hall', 'Logistics', 'Johns Creek, TX', 'Leading less-than-truckload carrier providing regional and interregional shipping services.'),
('careers@suncoke.com', 'SunCoke Energy', 'Tom Bradley', 'Manufacturing', 'Lisle, TX', 'Leading independent producer of high-quality coke used in blast furnace steel production.')
ON CONFLICT (email) DO NOTHING;

-- Seed job listings linked to civilian roles
-- NOV job listings
INSERT INTO job_listings (employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
SELECT e.id, cr.id, jl.title, jl.description, jl.requirements::text[], jl.location, jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible
FROM employers e
CROSS JOIN LATERAL (VALUES
    -- NOV: Fleet & Logistics Manager
    ('11-3071.00', 'Fleet Operations Manager', 'Oversee fleet of 80+ service vehicles across Texas field operations. Coordinate logistics for equipment delivery to drilling sites. Manage maintenance schedules and driver assignments. Report directly to VP of Field Operations.', ARRAY['CDL preferred', 'Fleet management experience', 'Logistics coordination', 'Team leadership 5+ people', 'DOT compliance knowledge'], 'Houston, TX', 75000, 105000, 'full-time', true),
    -- NOV: Heavy Equipment Mechanic
    ('49-3042.00', 'Field Service Mechanic — Drilling Equipment', 'Perform preventive and corrective maintenance on NOV drilling equipment at customer sites across the Permian Basin. Diagnose hydraulic, pneumatic, and electrical systems. 50% travel within Texas.', ARRAY['Hydraulic systems experience', 'Electrical troubleshooting', 'Welding certification preferred', 'Valid driver license', 'Able to lift 50 lbs'], 'Odessa, TX', 58000, 82000, 'full-time', true),
    -- NOV: Warehouse Supervisor
    ('53-1043.00', 'Warehouse Operations Supervisor', 'Lead team of 12 warehouse associates at Houston distribution center. Manage inbound/outbound shipments of drilling components. Ensure inventory accuracy and safety compliance. SAP experience a plus.', ARRAY['Team supervision experience', 'Inventory management', 'Forklift certification', 'Safety protocols', 'Computer literacy'], 'Houston, TX', 55000, 72000, 'full-time', true),
    -- NOV: CDL Truck Driver
    ('53-3032.00', 'CDL Driver — Equipment Transport', 'Transport oversize drilling equipment between NOV facilities and customer sites throughout Texas and Oklahoma. Must maintain DOT logs and perform pre/post-trip inspections.', ARRAY['CDL Class A license', 'Clean driving record', 'Oversize load experience preferred', 'DOT compliance', 'Self-motivated'], 'Houston, TX', 52000, 74000, 'full-time', true)
) AS jl(onet, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
JOIN civilian_roles cr ON cr.onet_code = jl.onet
WHERE e.company_name LIKE 'NOV%';

-- GE Vernova job listings
INSERT INTO job_listings (employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
SELECT e.id, cr.id, jl.title, jl.description, jl.requirements::text[], jl.location, jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible
FROM employers e
CROSS JOIN LATERAL (VALUES
    -- GE Vernova: Wind Turbine Tech
    ('49-9081.00', 'Wind Turbine Service Technician', 'Service and maintain GE Haliade-X and Cypress wind turbines at West Texas wind farms. Perform scheduled maintenance, troubleshoot electrical and mechanical systems, and complete safety inspections at heights up to 300 feet.', ARRAY['Mechanical aptitude', 'Comfortable working at heights', 'Electrical systems knowledge', 'Valid driver license', 'Physical fitness required'], 'Sweetwater, TX', 52000, 78000, 'full-time', true),
    -- GE Vernova: Safety Specialist
    ('29-9011.00', 'EHS Specialist — Wind Operations', 'Develop and enforce environmental, health, and safety programs across 3 Texas wind farm sites. Conduct incident investigations, safety audits, and OSHA compliance training. Report to Regional EHS Director.', ARRAY['OSHA 30 certification preferred', 'Safety program development', 'Incident investigation', 'Training delivery skills', 'Field operations experience'], 'Abilene, TX', 62000, 88000, 'full-time', true),
    -- GE Vernova: Maintenance Supervisor
    ('49-1011.00', 'Maintenance Team Lead — Renewables', 'Lead a team of 8 wind turbine technicians across a 200-turbine wind farm. Schedule maintenance rotations, manage parts inventory, ensure 98%+ uptime targets. Military leadership experience highly valued.', ARRAY['Team leadership 5+ people', 'Maintenance planning', 'Technical troubleshooting', 'Inventory management', 'Strong communication skills'], 'Sweetwater, TX', 68000, 95000, 'full-time', true)
) AS jl(onet, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
JOIN civilian_roles cr ON cr.onet_code = jl.onet
WHERE e.company_name LIKE 'GE Vernova%';

-- KBR job listings
INSERT INTO job_listings (employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
SELECT e.id, cr.id, jl.title, jl.description, jl.requirements::text[], jl.location, jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible
FROM employers e
CROSS JOIN LATERAL (VALUES
    -- KBR: Construction Manager
    ('11-9021.00', 'Construction Project Manager — Government Facilities', 'Manage renovation and new construction projects at military installations across Texas. Coordinate subcontractors, maintain schedules, and ensure compliance with government specifications. Secret clearance a plus.', ARRAY['Construction management experience', 'Blueprint reading', 'Project scheduling', 'Government contract familiarity', 'PMP certification preferred'], 'San Antonio, TX', 82000, 115000, 'full-time', true),
    -- KBR: Construction Laborer
    ('47-2061.00', 'General Construction Foreman', 'Supervise construction crews on federal building projects near Fort Cavazos. Coordinate daily work assignments, enforce safety protocols, manage materials delivery, and report progress to project manager.', ARRAY['Construction experience', 'Team supervision', 'OSHA 10 certification', 'Blueprint reading basics', 'Physical fitness'], 'Killeen, TX', 48000, 65000, 'full-time', true),
    -- KBR: Civil Engineering Tech
    ('17-3022.00', 'Civil Engineering Technician', 'Support civil engineering projects with surveying, testing, and documentation. Assist engineers with site assessments, soil testing, and construction quality control inspections.', ARRAY['Engineering technician experience', 'Surveying equipment', 'AutoCAD basics', 'Technical documentation', 'Detail-oriented'], 'Houston, TX', 52000, 72000, 'full-time', true)
) AS jl(onet, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
JOIN civilian_roles cr ON cr.onet_code = jl.onet
WHERE e.company_name LIKE 'KBR%';

-- Fluor Corporation job listings
INSERT INTO job_listings (employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
SELECT e.id, cr.id, jl.title, jl.description, jl.requirements::text[], jl.location, jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible
FROM employers e
CROSS JOIN LATERAL (VALUES
    ('47-2111.00', 'Industrial Electrician', 'Install, maintain, and troubleshoot electrical systems at petrochemical construction sites. Work with 480V motor controls, PLC systems, and instrumentation. Must be comfortable in industrial environments.', ARRAY['Electrical systems experience', 'Industrial wiring', 'Lockout/tagout procedures', 'Blueprint reading', 'Journeyman license preferred'], 'Corpus Christi, TX', 56000, 85000, 'full-time', true),
    ('47-2152.00', 'Pipefitter — Industrial Construction', 'Fabricate, assemble, and install piping systems for refinery expansion project. Read isometric drawings, perform hydrostatic testing, and ensure compliance with ASME codes. Overtime available.', ARRAY['Pipefitting experience', 'Welding skills', 'Blueprint/isometric reading', 'ASME code knowledge', 'Safety-focused'], 'Port Arthur, TX', 58000, 82000, 'full-time', true)
) AS jl(onet, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
JOIN civilian_roles cr ON cr.onet_code = jl.onet
WHERE e.company_name LIKE 'Fluor%';

-- XTO Energy (ExxonMobil) job listings
INSERT INTO job_listings (employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
SELECT e.id, cr.id, jl.title, jl.description, jl.requirements::text[], jl.location, jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible
FROM employers e
CROSS JOIN LATERAL (VALUES
    ('47-5013.00', 'Production Operator — Oil & Gas', 'Operate and monitor production equipment at Permian Basin well sites. Perform routine maintenance, collect samples, and ensure environmental compliance. Rotational schedule (14/14).', ARRAY['Mechanical aptitude', 'Safety-conscious', 'Outdoor work comfort', 'Basic computer skills', 'Team player'], 'Midland, TX', 55000, 78000, 'full-time', true),
    ('51-8091.00', 'Chemical Plant Operator', 'Monitor and control chemical processing equipment at natural gas processing plant. Maintain operating parameters, respond to alarms, and coordinate with maintenance teams for equipment repairs.', ARRAY['Process operations knowledge', 'Safety protocol adherence', 'Computer monitoring systems', 'Shift work flexibility', 'Hazmat awareness'], 'Baytown, TX', 62000, 88000, 'full-time', true)
) AS jl(onet, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
JOIN civilian_roles cr ON cr.onet_code = jl.onet
WHERE e.company_name LIKE 'XTO%';

-- Targa Resources
INSERT INTO job_listings (employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
SELECT e.id, cr.id, jl.title, jl.description, jl.requirements::text[], jl.location, jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible
FROM employers e
CROSS JOIN LATERAL (VALUES
    ('49-3031.00', 'Diesel Mechanic — Gas Compression', 'Maintain and repair diesel-driven gas compressors at field gathering stations. Diagnose engine, transmission, and cooling system issues. Perform overhauls and keep detailed maintenance records.', ARRAY['Diesel engine repair', 'Hydraulic systems', 'Preventive maintenance', 'Documentation skills', 'CDL preferred'], 'Midland, TX', 58000, 80000, 'full-time', true),
    ('53-6051.00', 'Pipeline Safety Inspector', 'Inspect midstream pipeline infrastructure for corrosion, leaks, and code compliance. Conduct pressure testing, cathodic protection surveys, and DOT compliance audits across Texas operations.', ARRAY['Inspection experience', 'DOT/PHMSA regulations', 'Documentation', 'Attention to detail', 'Travel within Texas'], 'Houston, TX', 60000, 85000, 'full-time', true)
) AS jl(onet, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
JOIN civilian_roles cr ON cr.onet_code = jl.onet
WHERE e.company_name LIKE 'Targa%';

-- CenterPoint Energy
INSERT INTO job_listings (employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
SELECT e.id, cr.id, jl.title, jl.description, jl.requirements::text[], jl.location, jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible
FROM employers e
CROSS JOIN LATERAL (VALUES
    ('49-9071.00', 'Utility Maintenance Technician', 'Perform maintenance and repairs on natural gas distribution infrastructure. Respond to emergency calls, install and repair gas meters, and ensure compliance with safety codes. On-call rotation required.', ARRAY['Mechanical skills', 'Gas distribution knowledge preferred', 'Customer service', 'Emergency response', 'Valid driver license'], 'Houston, TX', 48000, 68000, 'full-time', true),
    ('11-3013.00', 'Facilities Operations Manager', 'Manage daily operations of CenterPoint service center facilities. Oversee maintenance staff, coordinate vendor services, manage budgets, and ensure building systems run efficiently.', ARRAY['Facilities management', 'Team supervision', 'Budget management', 'Vendor coordination', 'Building systems knowledge'], 'Houston, TX', 72000, 98000, 'full-time', true)
) AS jl(onet, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
JOIN civilian_roles cr ON cr.onet_code = jl.onet
WHERE e.company_name LIKE 'CenterPoint%';

-- Saia Inc (Logistics)
INSERT INTO job_listings (employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
SELECT e.id, cr.id, jl.title, jl.description, jl.requirements::text[], jl.location, jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible
FROM employers e
CROSS JOIN LATERAL (VALUES
    ('43-5011.00', 'Freight Operations Coordinator', 'Coordinate inbound and outbound freight shipments at Dallas terminal. Schedule pickups and deliveries, resolve shipping exceptions, and maintain customer communication. Fast-paced environment.', ARRAY['Logistics experience', 'Communication skills', 'Computer proficiency', 'Problem-solving', 'Customer service'], 'Dallas, TX', 42000, 58000, 'full-time', true),
    ('43-5071.00', 'Inventory Control Specialist', 'Manage inventory accuracy at Houston distribution center. Conduct cycle counts, reconcile discrepancies, generate reports, and coordinate with purchasing on reorder points.', ARRAY['Inventory management', 'Attention to detail', 'Spreadsheet proficiency', 'Physical ability to move goods', 'Organizational skills'], 'Houston, TX', 38000, 52000, 'full-time', true),
    ('43-5061.00', 'Production Planning Coordinator', 'Plan and schedule freight movements across the Texas network. Optimize routes, coordinate with drivers and warehouse teams, and track KPIs for on-time delivery performance.', ARRAY['Planning & scheduling', 'Logistics coordination', 'Analytical skills', 'TMS software preferred', 'Multi-tasking ability'], 'Dallas, TX', 45000, 62000, 'full-time', true)
) AS jl(onet, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
JOIN civilian_roles cr ON cr.onet_code = jl.onet
WHERE e.company_name LIKE 'Saia%';

-- McCarthy Building
INSERT INTO job_listings (employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
SELECT e.id, cr.id, jl.title, jl.description, jl.requirements::text[], jl.location, jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible
FROM employers e
CROSS JOIN LATERAL (VALUES
    ('47-2031.00', 'Carpenter — Commercial Construction', 'Build and install frameworks, forms, and finishes on large commercial projects including hospitals and data centers. Read blueprints, operate power tools, and work collaboratively with other trades.', ARRAY['Carpentry skills', 'Blueprint reading', 'Power tool proficiency', 'Physical stamina', 'Team collaboration'], 'Austin, TX', 46000, 68000, 'full-time', true),
    ('51-1011.00', 'Production Supervisor — Prefabrication', 'Supervise team of 15 workers in prefabrication shop producing structural steel and MEP assemblies. Manage production schedules, quality control, and safety compliance. Military leadership valued.', ARRAY['Team supervision', 'Manufacturing/production experience', 'Quality control', 'Safety protocols', 'Scheduling'], 'Dallas, TX', 55000, 78000, 'full-time', true)
) AS jl(onet, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
JOIN civilian_roles cr ON cr.onet_code = jl.onet
WHERE e.company_name LIKE 'McCarthy%';

-- SunCoke Energy (Manufacturing)
INSERT INTO job_listings (employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
SELECT e.id, cr.id, jl.title, jl.description, jl.requirements::text[], jl.location, jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible
FROM employers e
CROSS JOIN LATERAL (VALUES
    ('13-1023.00', 'Purchasing Agent — Industrial Supplies', 'Procure raw materials, spare parts, and maintenance supplies for manufacturing operations. Negotiate with vendors, evaluate bids, and manage purchase orders. ERP system experience preferred.', ARRAY['Procurement experience', 'Vendor negotiation', 'ERP/SAP systems', 'Analytical skills', 'Contract knowledge'], 'Houston, TX', 52000, 72000, 'full-time', true)
) AS jl(onet, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible)
JOIN civilian_roles cr ON cr.onet_code = jl.onet
WHERE e.company_name LIKE 'SunCoke%';

-- Auto-create "matched" applications for any existing veterans who have MOS codes
-- This simulates the platform proactively matching veterans to jobs
INSERT INTO veteran_applications (veteran_id, job_listing_id, status, match_score)
SELECT v.id, jl.id, 'matched', mcm.match_score
FROM veterans v
JOIN mos_civilian_mappings mcm ON mcm.mos_code = v.mos_code
JOIN job_listings jl ON jl.civilian_role_id = mcm.civilian_role_id AND jl.is_active = true
WHERE v.mos_code IS NOT NULL
ON CONFLICT (veteran_id, job_listing_id) DO NOTHING;

-- Update journey_step for existing veterans based on their activity
UPDATE veterans SET journey_step = 'translate' WHERE mos_code IS NOT NULL AND journey_step = 'discover';
