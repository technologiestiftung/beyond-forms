ALTER TABLE users
    ADD COLUMN has_unavoidable_special_need BOOLEAN,
    ADD COLUMN was_self_employed_last_5_years BOOLEAN,
    ADD COLUMN received_wage_replacement_last_5_years BOOLEAN,
    ADD COLUMN did_military_or_voluntary_service_last_5_years BOOLEAN,
    ADD COLUMN cared_for_relatives_last_5_years BOOLEAN,
    ADD COLUMN azr_number VARCHAR(12);
