-- 002_seed_mos_data.sql
-- Seed MOS codes and civilian role mappings from O*NET crosswalk data
-- Focus on E4-E6 NCO roles common at Fort Cavazos

-- MOS Codes (common logistics/operations/maintenance specialties)
INSERT INTO mos_codes (code, title, branch, description) VALUES
('88M', 'Motor Transport Operator', 'Army', 'Operates wheeled vehicles and equipment to transport personnel and cargo. Supervises and checks proper loading and unloading of cargo on vehicles and trailers.'),
('91B', 'Wheeled Vehicle Mechanic', 'Army', 'Performs maintenance and recovery operations on wheeled vehicles and associated items. Diagnoses and troubleshoots malfunctions on vehicle systems.'),
('92Y', 'Unit Supply Specialist', 'Army', 'Supervises and performs duties involving supply requests, receipt, storage, issue, accountability, and preservation of supplies and equipment.'),
('12B', 'Combat Engineer', 'Army', 'Constructs, maintains, and repairs structures including bridges, roads, and airfields. Operates heavy construction equipment.'),
('68W', 'Combat Medic Specialist', 'Army', 'Provides emergency medical treatment, limited primary care, and health protection. First responder on the battlefield.'),
('11B', 'Infantryman', 'Army', 'Employs, fires, and recovers anti-personnel mines and engages the enemy with close combat. Assists in reconnaissance operations.'),
('25B', 'Information Technology Specialist', 'Army', 'Maintains, tests, and repairs communications equipment. Provides technical assistance and training for computer systems.'),
('74D', 'Chemical Operations Specialist', 'Army', 'Operates chemical detection and decontamination equipment. Conducts surveys of hazardous areas.'),
('94E', 'Radio and Communications Security Repairer', 'Army', 'Performs field and sustainment maintenance on radio and communications security equipment.'),
('15T', 'UH-60 Helicopter Repairer', 'Army', 'Performs maintenance on UH-60 helicopters including troubleshooting mechanical, electrical, and hydraulic systems.')
ON CONFLICT (code) DO NOTHING;

-- Civilian Roles (industrial/blue-collar focus for Texas market)
INSERT INTO civilian_roles (onet_code, title, description, sector, avg_salary_min, avg_salary_max) VALUES
-- Logistics & Transportation
('11-3071.00', 'Transportation, Storage, and Distribution Manager', 'Plan, direct, or coordinate transportation, storage, or distribution activities.', 'Logistics', 72000, 120000),
('43-5011.00', 'Cargo and Freight Agent', 'Expedite and route movement of incoming and outgoing cargo and freight shipments.', 'Logistics', 38000, 62000),
('53-1043.00', 'First-Line Supervisor of Material-Moving Workers', 'Directly supervise and coordinate activities of material-moving machine and vehicle operators.', 'Logistics', 48000, 78000),
('53-3032.00', 'Heavy and Tractor-Trailer Truck Driver', 'Drive a tractor-trailer combination or a truck with a capacity of at least 26,001 pounds.', 'Transportation', 42000, 72000),
('53-7051.00', 'Industrial Truck and Tractor Operator', 'Operate industrial trucks or tractors equipped to move materials around a warehouse or facility.', 'Logistics', 34000, 52000),
('43-5071.00', 'Shipping, Receiving, and Inventory Clerk', 'Verify and maintain records on incoming and outgoing shipments involving inventory.', 'Logistics', 32000, 48000),
('43-5061.00', 'Production, Planning, and Expediting Clerk', 'Coordinate and expedite the flow of work and materials within or between departments.', 'Logistics', 40000, 62000),
-- Maintenance & Repair
('49-3023.00', 'Automotive Service Technician and Mechanic', 'Diagnose, adjust, repair, or overhaul automotive vehicles.', 'Maintenance', 38000, 68000),
('49-3031.00', 'Bus and Truck Mechanic and Diesel Engine Specialist', 'Diagnose, adjust, repair, or overhaul buses, trucks, and diesel engines.', 'Maintenance', 42000, 72000),
('49-3042.00', 'Mobile Heavy Equipment Mechanic', 'Diagnose, adjust, repair, or overhaul mobile mechanical, hydraulic, and pneumatic equipment.', 'Maintenance', 46000, 78000),
('49-9071.00', 'Maintenance and Repair Worker, General', 'Perform work involving the skills of two or more maintenance or craft occupations.', 'Maintenance', 36000, 58000),
('49-1011.00', 'First-Line Supervisor of Mechanics and Repairers', 'Directly supervise and coordinate activities of mechanics, installers, and repairers.', 'Maintenance', 58000, 92000),
-- Construction & Engineering
('11-9021.00', 'Construction Manager', 'Plan, direct, or coordinate construction activities. May participate in conceptual development of a project.', 'Construction', 72000, 120000),
('47-2061.00', 'Construction Laborer', 'Perform tasks involving physical labor at construction sites.', 'Construction', 34000, 56000),
('47-2031.00', 'Carpenter', 'Construct, erect, install, or repair structures and fixtures made of wood and comparable materials.', 'Construction', 40000, 68000),
('47-2111.00', 'Electrician', 'Install, maintain, and repair electrical wiring, equipment, and fixtures.', 'Construction', 46000, 82000),
('47-2152.00', 'Plumber, Pipefitter, and Steamfitter', 'Assemble, install, alter, and repair pipelines or pipe systems.', 'Construction', 46000, 82000),
('17-3022.00', 'Civil Engineering Technician', 'Apply theory and principles of civil engineering in planning, designing, and overseeing construction.', 'Construction', 44000, 72000),
-- Energy & Field Operations
('49-9081.00', 'Wind Turbine Service Technician', 'Inspect, diagnose, adjust, or repair wind turbines. Perform maintenance on turbine equipment.', 'Energy', 48000, 82000),
('47-5013.00', 'Service Unit Operator, Oil and Gas', 'Operate equipment to increase oil flow from producing wells or remove stuck pipe and other obstructions.', 'Energy', 42000, 74000),
('51-8091.00', 'Chemical Plant and System Operator', 'Control or operate chemical processes or systems of machines.', 'Energy', 52000, 82000),
-- Safety & Compliance
('29-9011.00', 'Occupational Health and Safety Specialist', 'Review, evaluate, and analyze work environments to design programs and procedures.', 'Safety', 52000, 86000),
('53-6051.00', 'Transportation Inspector', 'Inspect equipment or goods in connection with the safe transport of cargo or people.', 'Safety', 48000, 82000),
-- Healthcare (for 68W medics)
('29-2042.00', 'Emergency Medical Technician', 'Assess injuries, administer emergency medical care, and extricate trapped individuals.', 'Healthcare', 32000, 52000),
('29-2043.00', 'Paramedic', 'Administer basic and advanced emergency medical care and transport to medical facilities.', 'Healthcare', 38000, 62000),
('29-2061.00', 'Licensed Practical Nurse', 'Care for ill, injured, or convalescing patients under the direction of physicians and registered nurses.', 'Healthcare', 42000, 58000),
-- Supply Chain & Purchasing
('11-3061.00', 'Purchasing Manager', 'Plan, direct, or coordinate the activities of buyers, purchasing officers, and related workers.', 'Supply Chain', 68000, 120000),
('13-1023.00', 'Purchasing Agent', 'Purchase machinery, equipment, tools, parts, supplies, or services necessary for operation.', 'Supply Chain', 48000, 78000),
-- Supervisory & Management
('11-3013.00', 'Facilities Manager', 'Plan, direct, or coordinate operations and maintenance functions of facilities.', 'Management', 62000, 105000),
('51-1011.00', 'First-Line Supervisor of Production Workers', 'Directly supervise and coordinate the activities of production and operating workers.', 'Manufacturing', 48000, 78000)
ON CONFLICT (onet_code) DO NOTHING;

-- MOS to Civilian Role Mappings
-- 88M Motor Transport Operator mappings
INSERT INTO mos_civilian_mappings (mos_code, civilian_role_id, match_score, transferable_skills)
SELECT '88M', cr.id, ms.score, ms.skills::text[]
FROM (VALUES
    ('11-3071.00', 88, ARRAY['fleet management', 'logistics coordination', 'route planning', 'team leadership']),
    ('53-3032.00', 95, ARRAY['vehicle operation', 'cargo handling', 'safety compliance', 'route navigation']),
    ('53-1043.00', 85, ARRAY['team supervision', 'material handling', 'safety protocols', 'operations management']),
    ('43-5011.00', 80, ARRAY['freight coordination', 'shipping logistics', 'documentation', 'scheduling']),
    ('53-7051.00', 82, ARRAY['equipment operation', 'material handling', 'warehouse operations', 'safety compliance']),
    ('53-6051.00', 75, ARRAY['vehicle inspection', 'safety compliance', 'regulatory knowledge', 'documentation']),
    ('43-5061.00', 72, ARRAY['logistics planning', 'scheduling', 'coordination', 'documentation'])
) AS ms(onet, score, skills)
JOIN civilian_roles cr ON cr.onet_code = ms.onet
ON CONFLICT (mos_code, civilian_role_id) DO NOTHING;

-- 91B Wheeled Vehicle Mechanic mappings
INSERT INTO mos_civilian_mappings (mos_code, civilian_role_id, match_score, transferable_skills)
SELECT '91B', cr.id, ms.score, ms.skills::text[]
FROM (VALUES
    ('49-3023.00', 95, ARRAY['vehicle diagnostics', 'mechanical repair', 'electrical systems', 'preventive maintenance']),
    ('49-3031.00', 92, ARRAY['diesel engine repair', 'hydraulic systems', 'fleet maintenance', 'troubleshooting']),
    ('49-3042.00', 88, ARRAY['heavy equipment repair', 'hydraulic systems', 'welding', 'field repairs']),
    ('49-9071.00', 80, ARRAY['multi-trade skills', 'troubleshooting', 'equipment maintenance', 'repair documentation']),
    ('49-1011.00', 78, ARRAY['team supervision', 'maintenance scheduling', 'quality control', 'technical training']),
    ('49-9081.00', 70, ARRAY['mechanical systems', 'hydraulics', 'electrical diagnostics', 'safety protocols'])
) AS ms(onet, score, skills)
JOIN civilian_roles cr ON cr.onet_code = ms.onet
ON CONFLICT (mos_code, civilian_role_id) DO NOTHING;

-- 92Y Unit Supply Specialist mappings
INSERT INTO mos_civilian_mappings (mos_code, civilian_role_id, match_score, transferable_skills)
SELECT '92Y', cr.id, ms.score, ms.skills::text[]
FROM (VALUES
    ('43-5071.00', 95, ARRAY['inventory management', 'shipping/receiving', 'record keeping', 'supply chain tracking']),
    ('43-5061.00', 88, ARRAY['production planning', 'material coordination', 'scheduling', 'documentation']),
    ('13-1023.00', 82, ARRAY['procurement', 'vendor management', 'contract evaluation', 'cost analysis']),
    ('11-3061.00', 75, ARRAY['purchasing strategy', 'team leadership', 'supplier relationships', 'budget management']),
    ('11-3071.00', 78, ARRAY['distribution management', 'inventory control', 'logistics coordination', 'warehouse operations']),
    ('43-5011.00', 80, ARRAY['freight documentation', 'shipping coordination', 'inventory tracking', 'logistics planning'])
) AS ms(onet, score, skills)
JOIN civilian_roles cr ON cr.onet_code = ms.onet
ON CONFLICT (mos_code, civilian_role_id) DO NOTHING;

-- 12B Combat Engineer mappings
INSERT INTO mos_civilian_mappings (mos_code, civilian_role_id, match_score, transferable_skills)
SELECT '12B', cr.id, ms.score, ms.skills::text[]
FROM (VALUES
    ('47-2061.00', 92, ARRAY['construction operations', 'heavy equipment', 'demolition', 'site preparation']),
    ('11-9021.00', 80, ARRAY['project management', 'team leadership', 'construction planning', 'resource coordination']),
    ('47-2031.00', 78, ARRAY['structural construction', 'blueprint reading', 'measurement', 'material handling']),
    ('47-2111.00', 72, ARRAY['electrical systems', 'wiring', 'safety protocols', 'technical skills']),
    ('47-2152.00', 70, ARRAY['pipe systems', 'welding', 'blueprint reading', 'installation']),
    ('17-3022.00', 75, ARRAY['engineering support', 'surveying', 'technical documentation', 'construction planning']),
    ('11-3013.00', 68, ARRAY['facility maintenance', 'operations management', 'team leadership', 'budgeting'])
) AS ms(onet, score, skills)
JOIN civilian_roles cr ON cr.onet_code = ms.onet
ON CONFLICT (mos_code, civilian_role_id) DO NOTHING;

-- 68W Combat Medic mappings
INSERT INTO mos_civilian_mappings (mos_code, civilian_role_id, match_score, transferable_skills)
SELECT '68W', cr.id, ms.score, ms.skills::text[]
FROM (VALUES
    ('29-2042.00', 95, ARRAY['emergency care', 'patient assessment', 'trauma response', 'medical protocols']),
    ('29-2043.00', 90, ARRAY['advanced life support', 'patient transport', 'medication administration', 'emergency protocols']),
    ('29-2061.00', 78, ARRAY['patient care', 'vital signs monitoring', 'medication administration', 'clinical documentation']),
    ('29-9011.00', 72, ARRAY['safety assessment', 'hazard identification', 'emergency planning', 'compliance monitoring'])
) AS ms(onet, score, skills)
JOIN civilian_roles cr ON cr.onet_code = ms.onet
ON CONFLICT (mos_code, civilian_role_id) DO NOTHING;

-- 11B Infantryman mappings (security, supervision, field operations)
INSERT INTO mos_civilian_mappings (mos_code, civilian_role_id, match_score, transferable_skills)
SELECT '11B', cr.id, ms.score, ms.skills::text[]
FROM (VALUES
    ('29-9011.00', 72, ARRAY['risk assessment', 'safety protocols', 'team coordination', 'field operations']),
    ('53-1043.00', 70, ARRAY['team supervision', 'operations management', 'logistics coordination', 'resource allocation']),
    ('47-2061.00', 68, ARRAY['physical labor', 'team operations', 'equipment handling', 'site security']),
    ('51-1011.00', 72, ARRAY['team leadership', 'operations supervision', 'quality control', 'training'])
) AS ms(onet, score, skills)
JOIN civilian_roles cr ON cr.onet_code = ms.onet
ON CONFLICT (mos_code, civilian_role_id) DO NOTHING;
