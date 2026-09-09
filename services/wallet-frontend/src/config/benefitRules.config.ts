/**
 * Legal constants for the benefit pre-assessment.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  EVERY VALUE IN THIS FILE IS UNVERIFIED.
 *
 *  Nothing here has been checked against an official source. Results computed
 *  from these values must not be presented to real people as an assessment.
 *  The open checklist lives in section 11 of both
 *    - leistungscheck-agent-spezifikation.md   (the domain spec)
 *    - docs/specs/2026-09-09-leistungscheck-teil-a-design.md
 *
 *  Provenance differs per constant and is noted on each one. Two of them were
 *  not in the domain spec at all and come from model knowledge — they are
 *  marked FROM MODEL KNOWLEDGE and are the first things to verify.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This file is the unit that gets ported if the logic later moves into the
 * rules-engine service. Keep every legal value here and nothing else.
 */

/**
 * Regelbedarfsstufen 1–6, §20/§28 SGB II and SGB XII, in EUR per month.
 *
 * FROM MODEL KNOWLEDGE — the domain spec marks this as TODO and supplies no numbers.
 * These are the 2024/2025 rates, which were carried over unchanged for 2025.
 * VERIFY against bmas.de before any real use, and note that the Grundsicherung
 * reform of 1 July 2026 may change them.
 */
export const STANDARD_NEEDS_BY_LEVEL: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
	1: 563, // single adult, or single parent
	2: 506, // per partner in a couple
	3: 451, // adult in someone else's household (incl. an adult child)
	4: 471, // child 14–17
	5: 390, // child 6–13
	6: 357, // child 0–5
};

/**
 * Regelaltersgrenze by birth year, §235 SGB VI.
 *
 * FROM MODEL KNOWLEDGE — the domain spec supplies only the approximation
 * "66.5 years, rising to 67 for the 1964 cohort" and marks the real table as TODO.
 * A flat 66.5 is wrong for almost every cohort, so the staggered table is
 * implemented instead. VERIFY against the statute before any real use.
 */
export const RETIREMENT_AGE_BY_BIRTH_YEAR = (
	birthYear: number,
): { years: number; months: number } => {
	if (birthYear <= 1946) {
		return { years: 65, months: 0 };
	}
	// 1947–1958: one extra month per cohort.
	if (birthYear <= 1958) {
		return { years: 65, months: birthYear - 1946 };
	}
	// 1959–1963: two extra months per cohort, on top of 66 years.
	if (birthYear <= 1963) {
		return { years: 66, months: (birthYear - 1958) * 2 };
	}
	return { years: 67, months: 0 };
};

/**
 * Asset allowance in EUR, staggered by age. Taken verbatim from the domain spec §5,
 * which describes the model in force from 1 July 2026 (age-staggered, replacing the
 * Karenzzeit model). Marked TODO there. UNVERIFIED.
 *
 * The domain spec notes an open question of whether SGB XII uses the same table as
 * SGB II; until that is answered, both use this one.
 */
export const ASSET_ALLOWANCE_BY_AGE: ReadonlyArray<{
	maxAgeExclusive: number;
	allowance: number;
}> = [
	{ maxAgeExclusive: 30, allowance: 5000 },
	{ maxAgeExclusive: 40, allowance: 10000 },
	{ maxAgeExclusive: 50, allowance: 12500 },
	{ maxAgeExclusive: Number.POSITIVE_INFINITY, allowance: 20000 },
];

/**
 * Minimum monthly GROSS income to qualify for Kinderzuschlag, §6a BKGG.
 * Taken from the domain spec §6.5 ("Recherchestand: 600 / 900 EUR brutto"). UNVERIFIED.
 */
export const KIZ_MIN_GROSS_INCOME = {
	single: 600,
	couple: 900,
} as const;

/**
 * Rent-to-income ratio above which Wohngeld is worth checking.
 *
 * This is NOT an official figure. The domain spec §6.4 declares it a heuristic of its
 * own making. The real decision needs the Wohngeld formula (§19 WoGG, Mietstufe 4 for
 * Berlin), which this pre-assessment deliberately does not implement.
 */
export const RENT_BURDEN_THRESHOLD = 0.3;

/**
 * Numeric ranges behind the asset bands the questionnaire offers, as [min, max).
 * Structural, not legal — these mirror the band labels in benefitCheck.schema.ts.
 */
export const ASSET_BAND_RANGE = {
	UNDER_5000: { min: 0, max: 5000 },
	FROM_5000_TO_15000: { min: 5000, max: 15000 },
	FROM_15000_TO_25000: { min: 15000, max: 25000 },
	OVER_25000: { min: 25000, max: Number.POSITIVE_INFINITY },
} as const;
