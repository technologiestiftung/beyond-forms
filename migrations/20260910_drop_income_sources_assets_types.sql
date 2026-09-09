-- Backfill before deleting JSONB columns

INSERT INTO income_entries (user_id, person_id, income_type)
SELECT DISTINCT
    u.id,
    NULL::uuid,
    CASE
        WHEN lower(v.value) IN ('pension', 'pension_retirement', 'pension_reduced', 'rente',
                                'altersrente', 'erwerbsminderungsrente')
            THEN 'Pension'::income_type
        WHEN lower(v.value) IN ('salary', 'minor_employment', 'employment', 'erwerbseinkommen')
            THEN 'Employment'::income_type
        WHEN lower(v.value) = 'other_benefits'
            THEN 'Social Assistance'::income_type
        WHEN lower(v.value) IN ('asylbezug', 'asylbewerberleistungen')
            THEN 'Asylum Seeker Benefits'::income_type
        ELSE 'Other Income'::income_type
    END
FROM users u
CROSS JOIN LATERAL jsonb_array_elements_text(u.income_sources) AS v(value)
WHERE u.income_sources IS NOT NULL
ON CONFLICT (user_id, income_type) WHERE person_id IS NULL DO NOTHING;

INSERT INTO asset_entries (user_id, person_id, asset_type)
SELECT DISTINCT
    u.id,
    NULL::uuid,
    CASE
        WHEN lower(v.value) IN ('liquid assets', 'savings', 'sparguthaben', 'guthaben/sparbuch',
                                'guthaben', 'sparbuch')
            THEN 'Savings and Cash'::asset_type
        WHEN lower(v.value) IN ('stocks', 'securities', 'wertpapiere')
            THEN 'Securities'::asset_type
        WHEN lower(v.value) = 'valuables'
            THEN 'Valuables'::asset_type
        WHEN lower(v.value) IN ('motor vehicle', 'kfz')
            THEN 'Motor Vehicle'::asset_type
        WHEN lower(v.value) IN ('real estate', 'grundbesitz', 'immobilien')
            THEN 'Real Estate'::asset_type
        ELSE 'Other Assets'::asset_type
    END
FROM users u
CROSS JOIN LATERAL jsonb_array_elements_text(u.assets_types) AS v(value)
WHERE u.assets_types IS NOT NULL
ON CONFLICT (user_id, asset_type) WHERE person_id IS NULL DO NOTHING;

ALTER TABLE users DROP COLUMN IF EXISTS income_sources;
ALTER TABLE users DROP COLUMN IF EXISTS assets_types;
