ALTER TYPE income_type ADD VALUE IF NOT EXISTS 'Old-Age Pension';
ALTER TYPE income_type ADD VALUE IF NOT EXISTS 'Reduced Earning Capacity Pension';
ALTER TYPE income_type ADD VALUE IF NOT EXISTS 'Survivor Pension';
ALTER TYPE displaced_status_type ADD VALUE IF NOT EXISTS 'none' BEFORE 'Expellee (Resettler)';
