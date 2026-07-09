CREATE TABLE IF NOT EXISTS berlin_addresses (
    id BIGSERIAL PRIMARY KEY,
    plz TEXT NOT NULL,
    street TEXT NOT NULL,
    hnr TEXT NOT NULL,
    bez_name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_berlin_addresses_lookup
    ON berlin_addresses (plz, street, hnr);
