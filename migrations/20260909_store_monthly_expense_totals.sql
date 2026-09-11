ALTER TABLE users
    ADD COLUMN IF NOT EXISTS monthly_expenses_total money_nonneg;

ALTER TABLE associated_persons
    ADD COLUMN IF NOT EXISTS monthly_expenses_total money_nonneg;


CREATE OR REPLACE FUNCTION recompute_monthly_expenses_total(p_user_id UUID, p_person_id UUID)
RETURNS VOID AS $$
BEGIN
    IF p_person_id IS NULL THEN
        IF p_user_id IS NULL THEN
            RETURN;
        END IF;
        PERFORM 1 FROM users WHERE id = p_user_id FOR NO KEY UPDATE;
        UPDATE users AS u
        SET monthly_expenses_total = totals.sum_amount
        FROM (
            SELECT COALESCE(SUM(monthly_amount), 0) AS sum_amount
            FROM expense_entries
            WHERE user_id = p_user_id AND person_id IS NULL
        ) AS totals
        WHERE u.id = p_user_id
          AND u.monthly_expenses_total IS DISTINCT FROM totals.sum_amount;
    ELSE
        UPDATE associated_persons AS p
        SET monthly_expenses_total = totals.sum_amount
        FROM (
            SELECT COALESCE(SUM(monthly_amount), 0) AS sum_amount
            FROM expense_entries
            WHERE person_id = p_person_id
        ) AS totals
        WHERE p.id = p_person_id
          AND p.monthly_expenses_total IS DISTINCT FROM totals.sum_amount;
    END IF;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION refresh_monthly_expenses_total()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        PERFORM recompute_monthly_expenses_total(OLD.user_id, OLD.person_id);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM recompute_monthly_expenses_total(NEW.user_id, NEW.person_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_expense_entries_refresh_total
    AFTER INSERT OR UPDATE OR DELETE ON expense_entries
    FOR EACH ROW
    EXECUTE FUNCTION refresh_monthly_expenses_total();


-- Backfill whatever rows already exist.
UPDATE users AS u
SET monthly_expenses_total = totals.sum_amount
FROM (
    SELECT user_id, COALESCE(SUM(monthly_amount), 0) AS sum_amount
    FROM expense_entries
    WHERE person_id IS NULL
    GROUP BY user_id
) AS totals
WHERE u.id = totals.user_id;

UPDATE associated_persons AS p
SET monthly_expenses_total = totals.sum_amount
FROM (
    SELECT person_id, COALESCE(SUM(monthly_amount), 0) AS sum_amount
    FROM expense_entries
    WHERE person_id IS NOT NULL
    GROUP BY person_id
) AS totals
WHERE p.id = totals.person_id;
