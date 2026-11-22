-- ============================================================================
-- RATAULI SAVING AND CREDIT COOPERATIVE LIMITED
-- FIXED ASSETS BULK SEED SQL (ALL 56 ASSETS ACROSS 4 BRANCHES)
-- ============================================================================
-- Run in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- 100% Idempotent (safe to re-run anytime; updates existing IDs without duplicates)
-- ============================================================================

-- 1. Ensure all 9 Asset Categories match the Fixed Asset Register
INSERT INTO public.asset_categories (
    id, code, name, default_method, rate, tax_block, tax_rate,
    useful_life_years, salvage_percent, gl_asset_account, gl_expense_account, gl_accumulated_account, status
) VALUES
    ('cat_building',              'FA-BLD', 'Building',                          'WDV',  5, 'Block A',  5, 30,  10, '1501 - Land & Buildings',          '5201 - Depreciation Expense', '1591 - Accumulated Depreciation (Buildings)',          'Active'),
    ('cat_building_improvement',  'FA-BIM', 'Building Improvement',              'SLM', 10, 'Block A',  5, 10,   0, '1501 - Building Improvement',      '5201 - Depreciation Expense', '1591 - Accumulated Depreciation (Building Imp.)',      'Active'),
    ('cat_it',                    'FA-CMP', 'Computer & IT',                     'WDV', 25, 'Block B', 25,  5,   5, '1502 - Computers & IT Equipment',  '5201 - Depreciation Expense', '1592 - Accumulated Depreciation (IT Equipment)',       'Active'),
    ('cat_furniture',             'FA-FRN', 'Furniture & Fixture',               'SLM', 15, 'Block B', 25,  7,   5, '1503 - Furniture & Fixtures',      '5201 - Depreciation Expense', '1593 - Accumulated Depreciation (Furniture)',          'Active'),
    ('cat_vehicle',               'FA-VEH', 'Vehicle',                           'WDV', 20, 'Block C', 20,  8,  10, '1504 - Vehicles & Transport',      '5201 - Depreciation Expense', '1594 - Accumulated Depreciation (Vehicles)',           'Active'),
    ('cat_machinery',             'FA-OEQ', 'Office Equipment',                  'WDV', 25, 'Block B', 25,  5,   5, '1505 - Office Equipment',          '5201 - Depreciation Expense', '1595 - Accumulated Depreciation (Office Equipment)',   'Active'),
    ('cat_electrical_equipment',  'FA-ELE', 'Electrical Equipment',              'WDV', 15, 'Block D', 15, 10,   5, '1506 - Electrical Equipment',      '5201 - Depreciation Expense', '1596 - Accumulated Depreciation (Electrical Equip.)',  'Active'),
    ('cat_electrical_electronic', 'FA-ELC', 'Electrical & Electronic Equipment', 'WDV', 15, 'Block D', 15, 10,   5, '1507 - Electrical & Electronic',   '5201 - Depreciation Expense', '1597 - Accumulated Depreciation (Elec. & Electronic)', 'Active'),
    ('cat_land',                  'FA-LND', 'Land',                              'SLM',  0, 'Block A',  0, 99, 100, '1500 - Land',                      '5201 - Depreciation Expense', '1590 - Accumulated Depreciation (Land)',               'Active')
ON CONFLICT (id) DO UPDATE SET
    code                   = EXCLUDED.code,
    name                   = EXCLUDED.name,
    default_method         = EXCLUDED.default_method,
    rate                   = EXCLUDED.rate,
    tax_block              = EXCLUDED.tax_block,
    tax_rate               = EXCLUDED.tax_rate,
    useful_life_years      = EXCLUDED.useful_life_years,
    salvage_percent        = EXCLUDED.salvage_percent,
    gl_asset_account       = EXCLUDED.gl_asset_account,
    gl_expense_account     = EXCLUDED.gl_expense_account,
    gl_accumulated_account = EXCLUDED.gl_accumulated_account,
    status                 = EXCLUDED.status,
    updated_at             = NOW();

-- 2. Insert / Upsert all 56 Fixed Assets across Pipra, Sahodba, Parsa & Head Office
INSERT INTO public.fixed_assets (
    id, asset_code, name, category_id, category_name,
    branch_id, branch_name, purchase_date, purchase_date_bs,
    put_to_use_date, put_to_use_date_bs,
    purchase_value, salvage_value, useful_life_years,
    method, depreciation_rate, tax_block, tax_rate,
    status, accumulated_depreciation, net_book_value,
    documents, created_by, created_at, updated_at
) VALUES
-- ==================== PIPRA BRANCH (9 Assets) ====================
('fa_pp_bld_004', 'PP-BLD-004', 'Light Board',                         'cat_electrical_electronic', 'Electrical & Electronic Equipment', 'pipra',   'Pipra Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',     5500,        0, 10, 'WDV', 15, 'Block D', 15, 'Active', 0,     5500, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pp_it_002',  'PP-IT-002',  'EPSON LQ-310',                        'cat_it',                    'Computer & IT',                     'pipra',   'Pipra Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    18000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    18000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pp_ele_002', 'PP-ELE-002', 'Sanwood Digital Voltage Transformer', 'cat_electrical_equipment',  'Electrical Equipment',              'pipra',   'Pipra Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    28000,        0, 10, 'WDV', 15, 'Block D', 15, 'Active', 0,    28000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pp_it_001',  'PP-IT-001',  'Computer Set',                        'cat_it',                    'Computer & IT',                     'pipra',   'Pipra Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    18000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    18000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pp_ele_001', 'PP-ELE-001', 'Inverter',                            'cat_electrical_equipment',  'Electrical Equipment',              'pipra',   'Pipra Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    92500,        0, 10, 'WDV', 15, 'Block D', 15, 'Active', 0,    92500, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pp_bld_003', 'PP-BLD-003', 'Glass Door',                          'cat_building_improvement',  'Building Improvement',              'pipra',   'Pipra Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    27000,        0, 10, 'SLM', 10, 'Block A',  5, 'Active', 0,    27000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pp_bld_002', 'PP-BLD-002', 'Office Counter & Partition',          'cat_building_improvement',  'Building Improvement',              'pipra',   'Pipra Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',   617500,        0, 10, 'SLM', 10, 'Block A',  5, 'Active', 0,   617500, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pp_bld_001', 'PP-BLD-001', 'Gypsm',                               'cat_building_improvement',  'Building Improvement',              'pipra',   'Pipra Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    40000,        0, 10, 'SLM', 10, 'Block A',  5, 'Active', 0,    40000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pp_fur_001', 'PP-FUR-001', 'Chair',                               'cat_furniture',             'Furniture & Fixture',               'pipra',   'Pipra Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    11000,        0,  7, 'SLM', 15, 'Block B', 25, 'Active', 0,    11000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),

-- ==================== SAHODBA BRANCH (11 Assets) ====================
('fa_sh_bld_006', 'SH-BLD-006', 'Wall Fan Orient',                     'cat_machinery',             'Office Equipment',                  'sahodba', 'Sahodba Branch',      '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',     7600,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,     7600, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_sh_it_003',  'SH-IT-003',  'Canon Scanner',                       'cat_it',                    'Computer & IT',                     'sahodba', 'Sahodba Branch',      '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    10000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    10000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_sh_bld_005', 'SH-BLD-005', 'Air Conditioner',                     'cat_machinery',             'Office Equipment',                  'sahodba', 'Sahodba Branch',      '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',   135000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,   135000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_sh_bld_004', 'SH-BLD-004', 'Light Board',                         'cat_electrical_electronic', 'Electrical & Electronic Equipment', 'sahodba', 'Sahodba Branch',      '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',     5000,        0, 10, 'WDV', 15, 'Block D', 15, 'Active', 0,     5000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_sh_ele_001', 'SH-ELE-001', 'CCTV',                                'cat_machinery',             'Office Equipment',                  'sahodba', 'Sahodba Branch',      '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    63000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    63000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_sh_it_002',  'SH-IT-002',  'EPSON LQ-310',                        'cat_it',                    'Computer & IT',                     'sahodba', 'Sahodba Branch',      '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    18000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    18000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_sh_it_001',  'SH-IT-001',  'Computer Set',                        'cat_it',                    'Computer & IT',                     'sahodba', 'Sahodba Branch',      '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    40000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    40000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_sh_fur_001', 'SH-FUR-001', 'Chair',                               'cat_furniture',             'Furniture & Fixture',               'sahodba', 'Sahodba Branch',      '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',     8000,        0,  7, 'SLM', 15, 'Block B', 25, 'Active', 0,     8000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_sh_bld_003', 'SH-BLD-003', 'Office Counter & Partition',          'cat_building_improvement',  'Building Improvement',              'sahodba', 'Sahodba Branch',      '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',   902500,        0, 10, 'SLM', 10, 'Block A',  5, 'Active', 0,   902500, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_sh_bld_002', 'SH-BLD-002', 'Gypsm',                               'cat_building_improvement',  'Building Improvement',              'sahodba', 'Sahodba Branch',      '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    64000,        0, 10, 'SLM', 10, 'Block A',  5, 'Active', 0,    64000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_sh_bld_001', 'SH-BLD-001', 'Glass Door',                          'cat_building_improvement',  'Building Improvement',              'sahodba', 'Sahodba Branch',      '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    40000,        0, 10, 'SLM', 10, 'Block A',  5, 'Active', 0,    40000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),

-- ==================== PARSA BRANCH (5 Assets) ====================
('fa_pr_bld_002', 'PR-BLD-002', 'Wall Fan',                            'cat_machinery',             'Office Equipment',                  'parsa',   'Parsa Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',     7660,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,     7660, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pr_it_003',  'PR-IT-003',  'Pentum Printer',                      'cat_it',                    'Computer & IT',                     'parsa',   'Parsa Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    12000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    12000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pr_it_002',  'PR-IT-002',  'Canon Scanner',                       'cat_it',                    'Computer & IT',                     'parsa',   'Parsa Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',     6000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,     6000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pr_it_001',  'PR-IT-001',  'Computer Set',                        'cat_it',                    'Computer & IT',                     'parsa',   'Parsa Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    40000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    40000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_pr_bld_001', 'PR-BLD-001', 'Aluminium Partition',                 'cat_building_improvement',  'Building Improvement',              'parsa',   'Parsa Branch',        '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',   143077,        0, 10, 'SLM', 10, 'Block A',  5, 'Active', 0,   143077, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),

-- ==================== HEAD OFFICE (31 Assets) ====================
('fa_fur_011',    'FUR-011',    'Office Front Ladder',                 'cat_building',              'Building',                          'main',    'Ratauli Head Office', '2024-07-24', '2081-04-09', '2024-07-24', '2081-04-09',    54000,        0, 30, 'WDV',  5, 'Block A',  5, 'Active', 0,    54000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_oeq_006',    'OEQ-006',    'Light Board',                         'cat_electrical_electronic', 'Electrical & Electronic Equipment', 'main',    'Ratauli Head Office', '2024-08-10', '2081-04-26', '2024-08-10', '2081-04-26',     5000,        0, 10, 'WDV', 15, 'Block D', 15, 'Active', 0,     5000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_oeq_005',    'OEQ-005',    'Note Counting Machine',               'cat_machinery',             'Office Equipment',                  'main',    'Ratauli Head Office', '2024-07-18', '2081-04-03', '2024-07-18', '2081-04-03',   225000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,   225000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_oeq_004',    'OEQ-004',    'Telephone Set',                       'cat_machinery',             'Office Equipment',                  'main',    'Ratauli Head Office', '2024-07-16', '2081-04-01', '2024-07-16', '2081-04-01',     3500,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,     3500, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_mac_005',    'MAC-005',    'CCTV',                                'cat_electrical_equipment',  'Electrical Equipment',              'main',    'Ratauli Head Office', '2024-07-25', '2081-04-10', '2024-07-25', '2081-04-10',   190000,        0, 10, 'WDV', 15, 'Block D', 15, 'Active', 0,   190000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_mac_004',    'MAC-004',    'Solar Panel',                         'cat_electrical_equipment',  'Electrical Equipment',              'main',    'Ratauli Head Office', '2024-07-16', '2081-04-01', '2024-07-16', '2081-04-01',     4000,        0, 10, 'WDV', 15, 'Block D', 15, 'Active', 0,     4000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_mac_003',    'MAC-003',    'Sanwood Digital Voltage Transformer', 'cat_electrical_equipment',  'Electrical Equipment',              'main',    'Ratauli Head Office', '2024-08-02', '2081-04-18', '2024-08-02', '2081-04-18',    24000,        0, 10, 'WDV', 15, 'Block D', 15, 'Active', 0,    24000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_mac_002',    'MAC-002',    'Inverter',                            'cat_electrical_equipment',  'Electrical Equipment',              'main',    'Ratauli Head Office', '2024-07-16', '2081-04-01', '2024-07-16', '2081-04-01',   128000,        0, 10, 'WDV', 15, 'Block D', 15, 'Active', 0,   128000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_oeq_003',    'OEQ-003',    'Water Dispenser',                     'cat_electrical_electronic', 'Electrical & Electronic Equipment', 'main',    'Ratauli Head Office', '2024-07-22', '2081-04-07', '2024-07-22', '2081-04-07',    13000,        0, 10, 'WDV', 15, 'Block D', 15, 'Active', 0,    13000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_oeq_002',    'OEQ-002',    'Wall Fan',                            'cat_machinery',             'Office Equipment',                  'main',    'Ratauli Head Office', '2024-07-20', '2081-04-05', '2024-07-20', '2081-04-05',     5000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,     5000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_oeq_001',    'OEQ-001',    'Ceiling Fan',                         'cat_machinery',             'Office Equipment',                  'main',    'Ratauli Head Office', '2024-07-18', '2081-04-03', '2024-07-18', '2081-04-03',    12750,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    12750, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_mac_001',    'MAC-001',    'Air Conditioner (A/C)',               'cat_machinery',             'Office Equipment',                  'main',    'Ratauli Head Office', '2024-07-18', '2081-04-03', '2024-07-18', '2081-04-03',   360000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,   360000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_it_007',     'IT-007',     'EPSON LQ-310',                        'cat_it',                    'Computer & IT',                     'main',    'Ratauli Head Office', '2024-08-18', '2081-05-02', '2024-08-18', '2081-05-02',     4000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,     4000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_it_006',     'IT-006',     'Brother Printer',                     'cat_it',                    'Computer & IT',                     'main',    'Ratauli Head Office', '2024-08-05', '2081-04-21', '2024-08-05', '2081-04-21',    77100,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    77100, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_it_005',     'IT-005',     'Canon LBP2900B Printer',              'cat_it',                    'Computer & IT',                     'main',    'Ratauli Head Office', '2024-09-10', '2081-05-25', '2024-09-10', '2081-05-25',     2000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,     2000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_it_004',     'IT-004',     'Canon Scanner',                       'cat_it',                    'Computer & IT',                     'main',    'Ratauli Head Office', '2024-09-01', '2081-05-16', '2024-09-01', '2081-05-16',    25500,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    25500, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_it_003',     'IT-003',     'PC Monitor',                          'cat_it',                    'Computer & IT',                     'main',    'Ratauli Head Office', '2024-08-12', '2081-04-28', '2024-08-12', '2081-04-28',    40000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    40000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_it_002',     'IT-002',     'Dell Laptop',                         'cat_it',                    'Computer & IT',                     'main',    'Ratauli Head Office', '2024-07-28', '2081-04-13', '2024-07-28', '2081-04-13',    54000,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,    54000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_it_001',     'IT-001',     'Computer Set',                        'cat_it',                    'Computer & IT',                     'main',    'Ratauli Head Office', '2024-07-18', '2081-04-03', '2024-07-18', '2081-04-03',   212500,        0,  5, 'WDV', 25, 'Block B', 25, 'Active', 0,   212500, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_fur_010',    'FUR-010',    'SUNDAR VAULT',                        'cat_furniture',             'Furniture & Fixture',               'main',    'Ratauli Head Office', '2024-07-16', '2081-04-01', '2024-07-16', '2081-04-01',    20000,        0,  7, 'SLM', 15, 'Block B', 25, 'Active', 0,    20000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_fur_009',    'FUR-009',    'KHUTURUKE BOX',                       'cat_furniture',             'Furniture & Fixture',               'main',    'Ratauli Head Office', '2024-08-15', '2081-04-31', '2024-08-15', '2081-04-31',    80000,        0,  7, 'SLM', 15, 'Block B', 25, 'Active', 0,    80000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_fur_008',    'FUR-008',    'File Daraj',                          'cat_furniture',             'Furniture & Fixture',               'main',    'Ratauli Head Office', '2024-07-25', '2081-04-10', '2024-07-25', '2081-04-10',    14400,        0,  7, 'SLM', 15, 'Block B', 25, 'Active', 0,    14400, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_fur_007',    'FUR-007',    'Inverter Stand',                      'cat_furniture',             'Furniture & Fixture',               'main',    'Ratauli Head Office', '2024-09-05', '2081-05-20', '2024-09-05', '2081-05-20',     6000,        0,  7, 'SLM', 15, 'Block B', 25, 'Active', 0,     6000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_fur_006',    'FUR-006',    'Aluminium Doors & Partition',         'cat_building_improvement',  'Building Improvement',              'main',    'Ratauli Head Office', '2024-07-18', '2081-04-03', '2024-07-18', '2081-04-03',   234000,        0, 10, 'SLM', 10, 'Block A',  5, 'Active', 0,   234000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_fur_005',    'FUR-005',    'Office Counter',                      'cat_building_improvement',  'Building Improvement',              'main',    'Ratauli Head Office', '2024-07-18', '2081-04-03', '2024-07-18', '2081-04-03',   332500,        0, 10, 'SLM', 10, 'Block A',  5, 'Active', 0,   332500, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_fur_004',    'FUR-004',    'Gypsum',                              'cat_building_improvement',  'Building Improvement',              'main',    'Ratauli Head Office', '2024-08-10', '2081-04-26', '2024-08-10', '2081-04-26',    38250,        0, 10, 'SLM', 10, 'Block A',  5, 'Active', 0,    38250, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_fur_003',    'FUR-003',    'Chair',                               'cat_furniture',             'Furniture & Fixture',               'main',    'Ratauli Head Office', '2024-07-22', '2081-04-07', '2024-07-22', '2081-04-07',    96000,        0,  7, 'SLM', 15, 'Block B', 25, 'Active', 0,    96000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_fur_002',    'FUR-002',    'Table',                               'cat_furniture',             'Furniture & Fixture',               'main',    'Ratauli Head Office', '2024-07-20', '2081-04-05', '2024-07-20', '2081-04-05',     5000,        0,  7, 'SLM', 15, 'Block B', 25, 'Active', 0,     5000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_fur_001',    'FUR-001',    'Godrej Daraj',                        'cat_furniture',             'Furniture & Fixture',               'main',    'Ratauli Head Office', '2024-07-20', '2081-04-05', '2024-07-20', '2081-04-05',    36000,        0,  7, 'SLM', 15, 'Block B', 25, 'Active', 0,    36000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_veh_001',    'VEH-001',    'Motorbike',                           'cat_vehicle',               'Vehicle',                           'main',    'Ratauli Head Office', '2024-08-01', '2081-04-17', '2024-08-01', '2081-04-17',    80000,        0,  8, 'WDV', 20, 'Block C', 20, 'Active', 0,    80000, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text),
('fa_lnd_001',    'LND-001',    'Land Purchase',                       'cat_land',                  'Land',                              'main',    'Ratauli Head Office', '2024-07-16', '2081-04-01', '2024-07-16', '2081-04-01', 13742838, 13742838, 99, 'SLM',  0, 'Block A',  0, 'Active', 0, 13742838, '[]'::jsonb, 'System Seed', NOW()::text, NOW()::text)
ON CONFLICT (id) DO UPDATE SET
    asset_code         = EXCLUDED.asset_code,
    name               = EXCLUDED.name,
    category_id        = EXCLUDED.category_id,
    category_name      = EXCLUDED.category_name,
    branch_id          = EXCLUDED.branch_id,
    branch_name        = EXCLUDED.branch_name,
    purchase_date      = EXCLUDED.purchase_date,
    purchase_date_bs   = EXCLUDED.purchase_date_bs,
    put_to_use_date    = EXCLUDED.put_to_use_date,
    put_to_use_date_bs = EXCLUDED.put_to_use_date_bs,
    purchase_value     = EXCLUDED.purchase_value,
    salvage_value      = EXCLUDED.salvage_value,
    useful_life_years  = EXCLUDED.useful_life_years,
    method             = EXCLUDED.method,
    depreciation_rate  = EXCLUDED.depreciation_rate,
    tax_block          = EXCLUDED.tax_block,
    tax_rate           = EXCLUDED.tax_rate,
    net_book_value     = EXCLUDED.net_book_value,
    updated_at         = NOW()::text;
