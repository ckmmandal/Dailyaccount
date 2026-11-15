-- =========================================================================
-- SQL SEED SCRIPT FOR REAL ASSET REGISTER (NPR)
-- Run this in your Supabase SQL Editor to populate/update the 'assets' table
-- =========================================================================

-- First, ensure the corresponding categories exist
INSERT INTO asset_categories (id, name, code, rate, method) VALUES
('1', 'Land', 'LND', 0.00, 'Straight Line'),
('2', 'Building Improvement', 'BLD', 5.00, 'Straight Line'),
('3', 'Computer & IT', 'IT', 25.00, 'Written Down Value'),
('4', 'Office Equipment', 'OEQ', 20.00, 'Written Down Value'),
('5', 'Furniture & Fixture', 'FUR', 20.00, 'Straight Line'),
('6', 'Vehicle', 'VEH', 20.00, 'Written Down Value'),
('7', 'Electrical Equipment', 'ELE', 20.00, 'Written Down Value')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    rate = EXCLUDED.rate,
    method = EXCLUDED.method;

-- Now insert/update the 31 assets with branch as 'Head Office'
INSERT INTO assets (
    id,
    asset_name,
    asset_code,
    category,
    purchase_cost,
    salvage_value,
    useful_life,
    depreciation_rate,
    purchase_date,
    depreciation_method,
    branch,
    department,
    created_by
) VALUES
(1, 'Land Purchase', 'LND-001', 'Land', 13742838.00, 0.00, 99, 0.00, '2024-07-16', 'Straight Line', 'Head Office', 'Finance', 'admin'),
(6, 'Gypsum', 'FUR-004', 'Building Improvement', 38250.00, 0.00, 10, 5.00, '2024-08-10', 'Straight Line', 'Head Office', 'Administration', 'admin'),
(7, 'Office Counter', 'FUR-005', 'Building Improvement', 332500.00, 33250.00, 10, 5.00, '2024-07-18', 'Straight Line', 'Head Office', 'Customer Service', 'admin'),
(8, 'Aluminium Doors & Partition', 'FUR-006', 'Building Improvement', 234000.00, 0.00, 10, 5.00, '2024-07-18', 'Straight Line', 'Head Office', 'Administration', 'admin'),
(30, 'Light Board', 'OEQ-006', 'Building Improvement', 5000.00, 500.00, 5, 5.00, '2024-08-10', 'Written Down Value', 'Head Office', 'Marketing', 'admin'),
(21, 'Ceiling Fan', 'OEQ-001', 'Building Improvement', 12750.00, 1275.00, 10, 5.00, '2024-07-18', 'Written Down Value', 'Head Office', 'Administration', 'admin'),
(22, 'Wall Fan', 'OEQ-002', 'Building Improvement', 5000.00, 500.00, 10, 5.00, '2024-07-20', 'Written Down Value', 'Head Office', 'Administration', 'admin'),
(20, 'Air Conditioner (A/C)', 'MAC-001', 'Building Improvement', 360000.00, 36000.00, 8, 5.00, '2024-07-18', 'Written Down Value', 'Head Office', 'Operations', 'admin'),
(2, 'Motorbike', 'VEH-001', 'Vehicle', 80000.00, 8000.00, 8, 20.00, '2024-08-01', 'Written Down Value', 'Head Office', 'Operations', 'admin'),
(11, 'KHUTURUKE BOX', 'FUR-009', 'Furniture & Fixture', 80000.00, 8000.00, 10, 20.00, '2024-08-15', 'Straight Line', 'Head Office', 'Cash Counter', 'admin'),
(3, 'Godrej Daraj', 'FUR-001', 'Furniture & Fixture', 36000.00, 3600.00, 10, 20.00, '2024-07-20', 'Straight Line', 'Head Office', 'Administration', 'admin'),
(4, 'Table', 'FUR-002', 'Furniture & Fixture', 5000.00, 500.00, 10, 20.00, '2024-07-20', 'Straight Line', 'Head Office', 'Administration', 'admin'),
(5, 'Chair', 'FUR-003', 'Furniture & Fixture', 96000.00, 9600.00, 10, 20.00, '2024-07-22', 'Straight Line', 'Head Office', 'Administration', 'admin'),
(9, 'Inverter Stand', 'FUR-007', 'Furniture & Fixture', 6000.00, 600.00, 10, 20.00, '2024-09-05', 'Straight Line', 'Head Office', 'Operations', 'admin'),
(10, 'File Daraj', 'FUR-008', 'Furniture & Fixture', 14400.00, 1440.00, 10, 20.00, '2024-07-25', 'Straight Line', 'Head Office', 'Administration', 'admin'),
(12, 'SUNDAR VAULT', 'FUR-010', 'Furniture & Fixture', 20000.00, 2000.00, 15, 20.00, '2024-07-16', 'Straight Line', 'Head Office', 'Cash Vault', 'admin'),
(24, 'Inverter', 'MAC-002', 'Electrical Equipment', 128000.00, 12800.00, 8, 20.00, '2024-07-16', 'Written Down Value', 'Head Office', 'Operations', 'admin'),
(25, 'Sanwood Digital Voltage Transformer', 'MAC-003', 'Electrical Equipment', 24000.00, 2400.00, 8, 20.00, '2024-08-02', 'Written Down Value', 'Head Office', 'Operations', 'admin'),
(27, 'CCTV', 'MAC-005', 'Electrical Equipment', 190000.00, 19000.00, 8, 20.00, '2024-07-25', 'Written Down Value', 'Head Office', 'Security', 'admin'),
(26, 'Solar Panel', 'MAC-004', 'Electrical Equipment', 4000.00, 400.00, 15, 20.00, '2024-07-16', 'Written Down Value', 'Head Office', 'Operations', 'admin'),
(28, 'Telephone Set', 'OEQ-004', 'Office Equipment', 3500.00, 350.00, 5, 20.00, '2024-07-16', 'Written Down Value', 'Head Office', 'Administration', 'admin'),
(31, 'Office Front Ladder', 'FUR-011', 'Office Equipment', 54000.00, 5400.00, 10, 20.00, '2024-07-24', 'Straight Line', 'Head Office', 'Administration', 'admin'),
(29, 'Note Counting Machine', 'OEQ-005', 'Office Equipment', 225000.00, 22500.00, 8, 20.00, '2024-07-18', 'Written Down Value', 'Head Office', 'Cash Counter', 'admin'),
(23, 'Water Dispenser', 'OEQ-003', 'Office Equipment', 13000.00, 1300.00, 10, 20.00, '2024-07-22', 'Written Down Value', 'Head Office', 'Administration', 'admin'),
(13, 'Computer Set', 'IT-001', 'Computer & IT', 212500.00, 21250.00, 5, 25.00, '2024-07-18', 'Written Down Value', 'Head Office', 'IT Support', 'admin'),
(14, 'Dell Laptop', 'IT-002', 'Computer & IT', 54000.00, 5400.00, 5, 25.00, '2024-07-28', 'Written Down Value', 'Head Office', 'Management', 'admin'),
(16, 'Canon Scanner', 'IT-004', 'Computer & IT', 25500.00, 2550.00, 5, 25.00, '2024-09-01', 'Written Down Value', 'Head Office', 'Administration', 'admin'),
(17, 'Canon LBP2900B Printer', 'IT-005', 'Computer & IT', 2000.00, 200.00, 5, 25.00, '2024-09-10', 'Written Down Value', 'Head Office', 'Administration', 'admin'),
(18, 'Brother Printer', 'IT-006', 'Computer & IT', 77100.00, 7710.00, 5, 25.00, '2024-08-05', 'Written Down Value', 'Head Office', 'Operations', 'admin'),
(19, 'EPSON LQ-310', 'IT-007', 'Computer & IT', 4000.00, 400.00, 5, 25.00, '2024-08-18', 'Written Down Value', 'Head Office', 'Operations', 'admin'),
(15, 'PC Monitor', 'IT-003', 'Computer & IT', 40000.00, 4000.00, 5, 25.00, '2024-08-12', 'Written Down Value', 'Head Office', 'Operations', 'admin'),

-- Parsa Branch Assets
(101, 'Aluminium Partition', 'PR-BLD-001', 'Building Improvement', 143077.00, 0.00, 10, 5.00, '2024-08-15', 'Straight Line', 'Parsa Branch', 'Administration', 'admin'),
(102, 'Computer Set', 'PR-IT-001', 'Computer & IT', 40000.00, 4000.00, 5, 25.00, '2024-08-15', 'Written Down Value', 'Parsa Branch', 'Operations', 'admin'),
(103, 'Canon Scanner', 'PR-IT-002', 'Computer & IT', 6000.00, 600.00, 5, 25.00, '2024-08-15', 'Written Down Value', 'Parsa Branch', 'Administration', 'admin'),
(104, 'Pentum Printer', 'PR-IT-003', 'Computer & IT', 12000.00, 1200.00, 5, 25.00, '2024-08-15', 'Written Down Value', 'Parsa Branch', 'Administration', 'admin'),
(105, 'Wall Fan', 'PR-BLD-002', 'Building Improvement', 7660.00, 766.00, 10, 5.00, '2024-08-15', 'Written Down Value', 'Parsa Branch', 'Administration', 'admin'),

-- Sahodba Branch Assets
(201, 'Glass Door', 'SH-BLD-001', 'Building Improvement', 40000.00, 0.00, 10, 5.00, '2024-08-15', 'Straight Line', 'Sahodba Branch', 'Administration', 'admin'),
(202, 'Gypsm', 'SH-BLD-002', 'Building Improvement', 64000.00, 0.00, 10, 5.00, '2024-08-15', 'Straight Line', 'Sahodba Branch', 'Administration', 'admin'),
(203, 'Office Counter & Partition', 'SH-BLD-003', 'Building Improvement', 902500.00, 90250.00, 10, 5.00, '2024-08-15', 'Straight Line', 'Sahodba Branch', 'Customer Service', 'admin'),
(204, 'Chair', 'SH-FUR-001', 'Furniture & Fixture', 8000.00, 800.00, 10, 20.00, '2024-08-15', 'Straight Line', 'Sahodba Branch', 'Administration', 'admin'),
(205, 'Computer Set', 'SH-IT-001', 'Computer & IT', 40000.00, 4000.00, 5, 25.00, '2024-08-15', 'Written Down Value', 'Sahodba Branch', 'Operations', 'admin'),
(206, 'EPSON LQ-310', 'SH-IT-002', 'Computer & IT', 18000.00, 1800.00, 5, 25.00, '2024-08-15', 'Written Down Value', 'Sahodba Branch', 'Operations', 'admin'),
(207, 'CCTV', 'SH-ELE-001', 'Electrical Equipment', 63000.00, 6300.00, 8, 20.00, '2024-08-15', 'Written Down Value', 'Sahodba Branch', 'Security', 'admin'),
(208, 'Light Board', 'SH-BLD-004', 'Building Improvement', 5000.00, 500.00, 5, 5.00, '2024-08-15', 'Written Down Value', 'Sahodba Branch', 'Marketing', 'admin'),
(209, 'Air Conditioner', 'SH-BLD-005', 'Building Improvement', 135000.00, 13500.00, 8, 5.00, '2024-08-15', 'Written Down Value', 'Sahodba Branch', 'Operations', 'admin'),
(210, 'Canon Scanner', 'SH-IT-003', 'Computer & IT', 10000.00, 1000.00, 5, 25.00, '2024-08-15', 'Written Down Value', 'Sahodba Branch', 'Administration', 'admin'),
(211, 'Wall Fan Orient', 'SH-BLD-006', 'Building Improvement', 7600.00, 760.00, 10, 5.00, '2024-08-15', 'Written Down Value', 'Sahodba Branch', 'Administration', 'admin'),

-- Pipra Branch Assets
(301, 'Chair', 'PP-FUR-001', 'Furniture & Fixture', 11000.00, 1100.00, 10, 20.00, '2024-08-15', 'Straight Line', 'Pipra Branch', 'Administration', 'admin'),
(302, 'Gypsm', 'PP-BLD-001', 'Building Improvement', 40000.00, 0.00, 10, 5.00, '2024-08-15', 'Straight Line', 'Pipra Branch', 'Administration', 'admin'),
(303, 'Office Counter & Partition', 'PP-BLD-002', 'Building Improvement', 617500.00, 61750.00, 10, 5.00, '2024-08-15', 'Straight Line', 'Pipra Branch', 'Customer Service', 'admin'),
(304, 'Glass Door', 'PP-BLD-003', 'Building Improvement', 27000.00, 0.00, 10, 5.00, '2024-08-15', 'Straight Line', 'Pipra Branch', 'Administration', 'admin'),
(305, 'Inverter', 'PP-ELE-001', 'Electrical Equipment', 92500.00, 9250.00, 8, 20.00, '2024-08-15', 'Written Down Value', 'Pipra Branch', 'Operations', 'admin'),
(306, 'Computer Set', 'PP-IT-001', 'Computer & IT', 18000.00, 1800.00, 5, 25.00, '2024-08-15', 'Written Down Value', 'Pipra Branch', 'Operations', 'admin'),
(307, 'Sanwood Digital Voltage Transformer', 'PP-ELE-002', 'Electrical Equipment', 28000.00, 2800.00, 8, 20.00, '2024-08-15', 'Written Down Value', 'Pipra Branch', 'Operations', 'admin'),
(308, 'EPSON LQ-310', 'PP-IT-002', 'Computer & IT', 18000.00, 1800.00, 5, 25.00, '2024-08-15', 'Written Down Value', 'Pipra Branch', 'Operations', 'admin'),
(309, 'Light Board', 'PP-BLD-004', 'Building Improvement', 5500.00, 550.00, 5, 5.00, '2024-08-15', 'Written Down Value', 'Pipra Branch', 'Marketing', 'admin')
ON CONFLICT (id) DO UPDATE SET
    asset_name = EXCLUDED.asset_name,
    category = EXCLUDED.category,
    purchase_cost = EXCLUDED.purchase_cost,
    salvage_value = EXCLUDED.salvage_value,
    useful_life = EXCLUDED.useful_life,
    depreciation_rate = EXCLUDED.depreciation_rate,
    purchase_date = EXCLUDED.purchase_date,
    depreciation_method = EXCLUDED.depreciation_method,
    branch = EXCLUDED.branch,
    department = EXCLUDED.department;
