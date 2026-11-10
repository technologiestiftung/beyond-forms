-- The applicant's generic 'Pension' rows predate the per-kind pension lines, which the wizard
-- rules and the frontend read. As in mappers.py, the earning capacity decides the kind of a
-- pension that names no reason. A row of that kind that already exists is left alone.
WITH converted AS (
    SELECT e.id,
           CASE
               WHEN u.has_permanent_reduction_in_earning_capacity
                   THEN 'Reduced Earning Capacity Pension'::income_type
               ELSE 'Old-Age Pension'::income_type
           END AS income_type,
           e.user_id
    FROM income_entries AS e
    JOIN users AS u ON u.id = e.user_id
    WHERE e.person_id IS NULL
      AND e.income_type = 'Pension'
)
UPDATE income_entries AS e
SET income_type = converted.income_type,
    updated_at = now()
FROM converted
WHERE e.id = converted.id
  AND NOT EXISTS (
      SELECT 1
      FROM income_entries AS other
      WHERE other.user_id = converted.user_id
        AND other.person_id IS NULL
        AND other.income_type = converted.income_type
  );
