ALTER TABLE users ADD COLUMN IF NOT EXISTS is_care_dependent BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS inpatient_facility_move_in_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS inpatient_facility_last_residence VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reduced_work_capacity_start_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reduced_work_capacity_end_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reduced_work_capacity_reason TEXT;
