# Leistungscheck Teil A — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die reine Entscheidungslogik einer Ersteinschätzung für sechs Sozialleistungen bauen — Antwortmodell, Rechtskonstanten, Ableitungsfunktionen, sechs Bewertungsfunktionen, Aggregation — ohne jede UI.

**Architecture:** Pure Funktionen im Frontend, `today` immer injiziert. Alle Rechtskonstanten isoliert in einem Modul, damit die Logik später in die Rules Engine portiert werden kann. Nichts wird gelöscht: Teil A legt neben dem bestehenden `EligibilityEngine` ab, der erst in Teil B entfällt.

**Tech Stack:** TypeScript, Zod 4, Vitest. Keine neuen Dependencies.

**Spec:** `docs/specs/2026-09-09-leistungscheck-teil-a-design.md`

## Global Constraints

- **Arbeitsverzeichnis für alle Kommandos:** `services/wallet-frontend`
- **Tests:** `npx vitest run <pfad>` für einzelne Dateien, `npm test` für die Suite
- **Vorbestehender Fehlschlag:** `src/views/Application/ApplicationOverview.test.tsx` ist rot, bevor dieser Plan beginnt. Baseline ist **268 grün / 1 rot**. Diese Zahl darf sich nur nach oben verändern; der eine rote Test bleibt rot und wird nicht angefasst.
- **Einrückung:** Tabs, nicht Spaces (Repo-Konvention, siehe `.prettierrc` über `@technologiestiftung/prettier-config`)
- **Enum-Stil:** `as const`-Objekt + gleichnamiger Type + `z.enum([...])`, exakt wie in `src/schemas/eligibility.schema.ts`
- **Datumsformat:** ISO `YYYY-MM-DD` als String. In der Logik wird **nie** ein `Date` konstruiert — Vergleiche laufen lexikografisch oder über Ganzzahl-Monatsarithmetik. Grund: `new Date("YYYY-MM-DD")` interpretiert UTC und verschiebt in negativen Zeitzonen den Tag.
- **Imports zusammenführen, nicht anhängen.** Mehrere Tasks erweitern dieselbe Datei. Wenn ein Task „Import ergänzen" sagt und es schon ein Value-Import-Statement aus demselben Modul gibt, wird dieses Statement **erweitert**, nicht ein zweites daneben gestellt. Ausnahme ist das im Repo übliche Paar aus einem Value-Import und einem separaten `import type` — siehe `src/store/useEligibilityStore.ts:3-7`. Das gilt für Quell- **und** Testdateien: `derive.test.ts` sammelt über Tasks 2–4 Importe aus `./derive`, `rules.test.ts` über Tasks 5–10 aus `./rules`.
- **Keine Anzeigetexte in der Logik.** Begründungen sind `ReasonCode`-Enums; die Übersetzung passiert in Teil C.
- **Kein Rechtswert außerhalb von `src/config/benefitRules.config.ts`.**
- **Commit-Präfix:** `feat:` bzw. `test:` nach Conventional Commits. Jeder Commit endet mit:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
- **Branch:** `ben-vibes` (bereits ausgecheckt)

---

## Dateistruktur

| Datei | Verantwortung | Task |
|---|---|---|
| `src/schemas/benefitCheck.schema.ts` | Antwortmodell, Enums, Ergebnistypen | 1 |
| `src/config/benefitRules.config.ts` | Rechtskonstanten, alle unverifiziert | 2 |
| `src/store/benefits/derive.ts` | Alter, Regelaltersgrenze, Freibetrag, Bedarf, Kinderfilter, Vermögensvergleich | 2–4 |
| `src/store/benefits/rules.ts` | sechs Bewertungsfunktionen | 5–10 |
| `src/store/benefits/evaluate.ts` | Aggregation, Hinweise | 11 |
| `src/store/benefits/*.test.ts` | Tests neben der Quelle | alle |

`src/store/benefits/` folgt dem Präzedenzfall `src/store/EligibilityEngine.ts` — dort liegt die bestehende Logik, obwohl es kein Zustand-Store ist.

---

## Task 1: Antwortmodell und Ergebnistypen

**Files:**
- Create: `src/schemas/benefitCheck.schema.ts`
- Test: `src/schemas/benefitCheck.schema.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: `BenefitCheckAnswersSchema`, `BenefitCheckAnswers`, `PartialBenefitCheckAnswers`, `WorkCapacity`, `HouseholdComposition`, `AssetsBand`, `Citizenship`, `BenefitId`, `BenefitStatus`, `ReasonCode`, `HintCode`, `BenefitAssessment`, `BenefitCheckResult`

- [ ] **Step 1: Write the failing test**

`src/schemas/benefitCheck.schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitCheckAnswersSchema,
	HouseholdComposition,
	WorkCapacity,
} from "./benefitCheck.schema";

describe("BenefitCheckAnswersSchema", () => {
	it("accepts a complete household with children", () => {
		const result = BenefitCheckAnswersSchema.shape.household.safeParse({
			composition: HouseholdComposition.SINGLE_PARENT,
			children: [{ dateOfBirth: "2019-04-02" }],
		});
		expect(result.success).toBe(true);
	});

	it("accepts an empty children array", () => {
		const result = BenefitCheckAnswersSchema.shape.household.safeParse({
			composition: HouseholdComposition.SINGLE,
			children: [],
		});
		expect(result.success).toBe(true);
	});

	it("rejects a child born in the future", () => {
		const result = BenefitCheckAnswersSchema.shape.household.safeParse({
			composition: HouseholdComposition.SINGLE_PARENT,
			children: [{ dateOfBirth: "2999-01-01" }],
		});
		expect(result.success).toBe(false);
	});

	it("rejects a calendar-invalid date of birth", () => {
		const result =
			BenefitCheckAnswersSchema.shape.dateOfBirth.safeParse("1990-02-30");
		expect(result.success).toBe(false);
	});

	it("rejects a date of birth before 1900", () => {
		const result =
			BenefitCheckAnswersSchema.shape.dateOfBirth.safeParse("1899-12-31");
		expect(result.success).toBe(false);
	});

	it("rejects a negative gross income", () => {
		const result = BenefitCheckAnswersSchema.shape.employment.safeParse({
			isEmployed: true,
			monthlyGrossIncome: -1,
		});
		expect(result.success).toBe(false);
	});

	it("exposes per-field schemas so the store can validate one answer at a time", () => {
		expect(
			BenefitCheckAnswersSchema.shape.workCapacity.safeParse(WorkCapacity.FULL)
				.success,
		).toBe(true);
		expect(
			BenefitCheckAnswersSchema.shape.assetsBand.safeParse(
				AssetsBand.FROM_5000_TO_15000,
			).success,
		).toBe(true);
		expect(
			BenefitCheckAnswersSchema.shape.assetsBand.safeParse("NOPE").success,
		).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/schemas/benefitCheck.schema.test.ts`
Expected: FAIL — `Failed to resolve import "./benefitCheck.schema"`

- [ ] **Step 3: Write minimal implementation**

`src/schemas/benefitCheck.schema.ts`:

```ts
import { z } from "zod";

export const WorkCapacity = {
	FULL: "FULL",
	PERMANENTLY_REDUCED: "PERMANENTLY_REDUCED",
	TEMPORARILY_REDUCED: "TEMPORARILY_REDUCED",
} as const;
export type WorkCapacity = (typeof WorkCapacity)[keyof typeof WorkCapacity];
export const WorkCapacitySchema = z.enum([
	WorkCapacity.FULL,
	WorkCapacity.PERMANENTLY_REDUCED,
	WorkCapacity.TEMPORARILY_REDUCED,
]);

export const HouseholdComposition = {
	SINGLE: "SINGLE",
	SINGLE_PARENT: "SINGLE_PARENT",
	COUPLE_NO_CHILDREN: "COUPLE_NO_CHILDREN",
	COUPLE_WITH_CHILDREN: "COUPLE_WITH_CHILDREN",
} as const;
export type HouseholdComposition =
	(typeof HouseholdComposition)[keyof typeof HouseholdComposition];
export const HouseholdCompositionSchema = z.enum([
	HouseholdComposition.SINGLE,
	HouseholdComposition.SINGLE_PARENT,
	HouseholdComposition.COUPLE_NO_CHILDREN,
	HouseholdComposition.COUPLE_WITH_CHILDREN,
]);

export const AssetsBand = {
	UNDER_5000: "UNDER_5000",
	FROM_5000_TO_15000: "FROM_5000_TO_15000",
	FROM_15000_TO_25000: "FROM_15000_TO_25000",
	OVER_25000: "OVER_25000",
} as const;
export type AssetsBand = (typeof AssetsBand)[keyof typeof AssetsBand];
export const AssetsBandSchema = z.enum([
	AssetsBand.UNDER_5000,
	AssetsBand.FROM_5000_TO_15000,
	AssetsBand.FROM_15000_TO_25000,
	AssetsBand.OVER_25000,
]);

export const Citizenship = {
	DE_EU: "DE_EU",
	NON_EU: "NON_EU",
} as const;
export type Citizenship = (typeof Citizenship)[keyof typeof Citizenship];
export const CitizenshipSchema = z.enum([
	Citizenship.DE_EU,
	Citizenship.NON_EU,
]);

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Guards against 2026-02-30 and friends, which the regex alone lets through. */
const isRealCalendarDate = (value: string): boolean => {
	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return (
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
	);
};

const todayIsoDate = (): string => {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

/**
 * Used for the applicant and for every child. Reading the clock is acceptable here because
 * this is input validation, not decision logic — the engine always takes `today` as an
 * argument so its outcomes stay testable.
 */
export const BirthDateSchema = z
	.string()
	.regex(ISO_DATE_PATTERN, "Invalid date format")
	.refine(isRealCalendarDate, "Invalid date")
	.refine((v) => v >= "1900-01-01", "Date must be on or after 1 January 1900")
	.refine((v) => v <= todayIsoDate(), "Date of birth cannot be in the future");

export const HouseholdSchema = z.object({
	composition: HouseholdCompositionSchema,
	children: z.array(z.object({ dateOfBirth: BirthDateSchema })),
});

export const EmploymentSchema = z.object({
	isEmployed: z.boolean(),
	monthlyGrossIncome: z.number().min(0),
});

export const ChildSupportSchema = z.object({
	receivesFullSupport: z.boolean(),
	monthsWithoutSupport: z.number().int().min(0),
});

/**
 * Flat on purpose: the questionnaire store validates one answer at a time via
 * `BenefitCheckAnswersSchema.shape[key]`, the way `useEligibilityStore` does today.
 */
export const BenefitCheckAnswersSchema = z.object({
	livesInBerlin: z.boolean(),
	dateOfBirth: BirthDateSchema,
	workCapacity: WorkCapacitySchema,
	household: HouseholdSchema,
	employment: EmploymentSchema,
	monthlyNetHouseholdIncome: z.number().min(0),
	monthlyWarmRent: z.number().min(0),
	assetsBand: AssetsBandSchema,
	receivesBenefitsAlready: z.boolean(),
	citizenship: CitizenshipSchema,
	hasSecureResidenceStatus: z.boolean(),
	childSupport: ChildSupportSchema,
});

export type BenefitCheckAnswers = z.infer<typeof BenefitCheckAnswersSchema>;
export type PartialBenefitCheckAnswers = Partial<BenefitCheckAnswers>;
export type Household = z.infer<typeof HouseholdSchema>;

export const BenefitId = {
	/** Grundsicherungsgeld, SGB II (bis 30.6.2026: Bürgergeld) */
	SGB_II_BASIC_INCOME: "SGB_II_BASIC_INCOME",
	/** Grundsicherung im Alter und bei Erwerbsminderung, SGB XII Kap. 4 */
	SGB_XII_OLD_AGE_REDUCED_CAPACITY: "SGB_XII_OLD_AGE_REDUCED_CAPACITY",
	/** Hilfe zum Lebensunterhalt, SGB XII Kap. 3 */
	SGB_XII_SUBSISTENCE_AID: "SGB_XII_SUBSISTENCE_AID",
	/** Wohngeld, WoGG */
	HOUSING_BENEFIT: "HOUSING_BENEFIT",
	/** Kinderzuschlag, §6a BKGG */
	CHILD_SUPPLEMENT: "CHILD_SUPPLEMENT",
	/** Unterhaltsvorschuss, UVG */
	ADVANCE_MAINTENANCE: "ADVANCE_MAINTENANCE",
} as const;
export type BenefitId = (typeof BenefitId)[keyof typeof BenefitId];

export const BenefitStatus = {
	LIKELY_YES: "LIKELY_YES",
	CHECK_ADVISED: "CHECK_ADVISED",
	LIKELY_NO: "LIKELY_NO",
	NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;
export type BenefitStatus = (typeof BenefitStatus)[keyof typeof BenefitStatus];

export const ReasonCode = {
	INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
	RETIREMENT_AGE_REACHED: "RETIREMENT_AGE_REACHED",
	RETIREMENT_AGE_NOT_REACHED: "RETIREMENT_AGE_NOT_REACHED",
	WORK_CAPACITY_NOT_FULL: "WORK_CAPACITY_NOT_FULL",
	NOT_IN_CAPACITY_GAP: "NOT_IN_CAPACITY_GAP",
	RESIDENCE_STATUS_UNCLEAR: "RESIDENCE_STATUS_UNCLEAR",
	ALREADY_RECEIVING_BENEFITS: "ALREADY_RECEIVING_BENEFITS",
	BENEFITS_TAKE_PRECEDENCE: "BENEFITS_TAKE_PRECEDENCE",
	INCOME_BELOW_NEEDS: "INCOME_BELOW_NEEDS",
	INCOME_COVERS_NEEDS: "INCOME_COVERS_NEEDS",
	INCOME_BELOW_SUBSISTENCE: "INCOME_BELOW_SUBSISTENCE",
	ASSETS_BELOW_ALLOWANCE: "ASSETS_BELOW_ALLOWANCE",
	ASSETS_SPAN_ALLOWANCE: "ASSETS_SPAN_ALLOWANCE",
	ASSETS_ABOVE_ALLOWANCE: "ASSETS_ABOVE_ALLOWANCE",
	RENT_BURDEN_HIGH: "RENT_BURDEN_HIGH",
	RENT_BURDEN_NORMAL: "RENT_BURDEN_NORMAL",
	NO_ELIGIBLE_CHILDREN: "NO_ELIGIBLE_CHILDREN",
	KIZ_MIN_INCOME_MET: "KIZ_MIN_INCOME_MET",
	KIZ_MIN_INCOME_NOT_MET: "KIZ_MIN_INCOME_NOT_MET",
	NOT_SINGLE_PARENT: "NOT_SINGLE_PARENT",
	NO_MINOR_CHILDREN: "NO_MINOR_CHILDREN",
	CHILD_RECEIVES_FULL_SUPPORT: "CHILD_RECEIVES_FULL_SUPPORT",
	CHILD_SUPPORT_INCOMPLETE: "CHILD_SUPPORT_INCOMPLETE",
	EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA: "EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA",
	CAPACITY_GAP_PRECONDITION_MET: "CAPACITY_GAP_PRECONDITION_MET",
} as const;
export type ReasonCode = (typeof ReasonCode)[keyof typeof ReasonCode];

export const HintCode = {
	EDUCATION_PARTICIPATION_PACKAGE: "EDUCATION_PARTICIPATION_PACKAGE",
	CHILD_BENEFIT_PREREQUISITE: "CHILD_BENEFIT_PREREQUISITE",
	ASYLUM_BENEFITS_REFERRAL: "ASYLUM_BENEFITS_REFERRAL",
} as const;
export type HintCode = (typeof HintCode)[keyof typeof HintCode];

export interface BenefitAssessment {
	benefit: BenefitId;
	status: BenefitStatus;
	reasons: ReasonCode[];
}

export interface BenefitCheckResult {
	/** Always all six, in the order of `BenefitId`. */
	assessments: BenefitAssessment[];
	hints: HintCode[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/schemas/benefitCheck.schema.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/schemas/benefitCheck.schema.ts src/schemas/benefitCheck.schema.test.ts
git commit -m "$(cat <<'EOF'
feat: add benefit check answer model and result types

Replaces the six-field EligibilityCheckSchema for the new six-benefit
pre-assessment. Flat top-level shape so the questionnaire store can keep
validating one answer at a time.

Children carry a date of birth rather than an age: the age cutoffs at 18 and 25
turn on a birthday, and associated_persons in the database has date_of_birth and
no age column.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rechtskonstanten und Altersableitung

**Files:**
- Create: `src/config/benefitRules.config.ts`
- Create: `src/store/benefits/derive.ts`
- Test: `src/store/benefits/derive.test.ts`

**Interfaces:**
- Consumes: nichts aus Task 1
- Produces: `STANDARD_NEEDS_BY_LEVEL`, `ASSET_ALLOWANCE_BY_AGE`, `RETIREMENT_AGE_BY_BIRTH_YEAR`, `KIZ_MIN_GROSS_INCOME`, `RENT_BURDEN_THRESHOLD`, `ASSET_BAND_RANGE`; `ageInYears(dateOfBirth: string, today: string): number`, `ageInMonths(dateOfBirth: string, today: string): number`, `hasReachedRetirementAge(dateOfBirth: string, today: string): boolean`

- [ ] **Step 1: Write the failing test**

`src/store/benefits/derive.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ageInMonths, ageInYears, hasReachedRetirementAge } from "./derive";

describe("ageInYears", () => {
	it("counts a birthday that has already passed this year", () => {
		expect(ageInYears("1990-03-15", "2026-09-09")).toBe(36);
	});

	it("does not count a birthday still ahead this year", () => {
		expect(ageInYears("1990-12-15", "2026-09-09")).toBe(35);
	});

	it("counts the birthday itself", () => {
		expect(ageInYears("1990-09-09", "2026-09-09")).toBe(36);
	});

	it("does not count the day before the birthday", () => {
		expect(ageInYears("1990-09-10", "2026-09-09")).toBe(35);
	});
});

describe("ageInMonths", () => {
	it("counts whole months only", () => {
		expect(ageInMonths("2026-01-15", "2026-09-09")).toBe(7);
		expect(ageInMonths("2026-01-09", "2026-09-09")).toBe(8);
	});
});

describe("hasReachedRetirementAge", () => {
	it("is false for someone clearly of working age", () => {
		expect(hasReachedRetirementAge("1990-01-01", "2026-09-09")).toBe(false);
	});

	it("uses 67 years for the 1964 cohort and later", () => {
		expect(hasReachedRetirementAge("1964-09-09", "2031-09-08")).toBe(false);
		expect(hasReachedRetirementAge("1964-09-09", "2031-09-09")).toBe(true);
	});

	it("uses 65 years for cohorts up to 1946", () => {
		expect(hasReachedRetirementAge("1946-06-01", "2011-05-31")).toBe(false);
		expect(hasReachedRetirementAge("1946-06-01", "2011-06-01")).toBe(true);
	});

	it("applies the staggered months for the 1959 cohort (66 years, 2 months)", () => {
		expect(hasReachedRetirementAge("1959-01-15", "2025-03-14")).toBe(false);
		expect(hasReachedRetirementAge("1959-01-15", "2025-03-15")).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/derive.test.ts`
Expected: FAIL — `Failed to resolve import "./derive"`

- [ ] **Step 3: Write minimal implementation**

`src/config/benefitRules.config.ts`:

```ts
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
```

`src/store/benefits/derive.ts`:

```ts
import { RETIREMENT_AGE_BY_BIRTH_YEAR } from "../../config/benefitRules.config";

/**
 * Whole months between two ISO dates. Deliberately string and integer arithmetic: passing
 * an ISO date to `new Date()` parses it as UTC, which shifts the day in negative offsets
 * and would make age cutoffs wrong for part of the day.
 */
export const ageInMonths = (dateOfBirth: string, today: string): number => {
	const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
	const [nowYear, nowMonth, nowDay] = today.split("-").map(Number);
	let months = (nowYear - birthYear) * 12 + (nowMonth - birthMonth);
	if (nowDay < birthDay) {
		months -= 1;
	}
	return months;
};

export const ageInYears = (dateOfBirth: string, today: string): number =>
	Math.floor(ageInMonths(dateOfBirth, today) / 12);

export const hasReachedRetirementAge = (
	dateOfBirth: string,
	today: string,
): boolean => {
	const birthYear = Number(dateOfBirth.slice(0, 4));
	const { years, months } = RETIREMENT_AGE_BY_BIRTH_YEAR(birthYear);
	return ageInMonths(dateOfBirth, today) >= years * 12 + months;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/derive.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/config/benefitRules.config.ts src/store/benefits/derive.ts src/store/benefits/derive.test.ts
git commit -m "$(cat <<'EOF'
feat: add benefit rules config and age derivation

Every legal constant lives in one file so it can be ported to the rules-engine
later, and so the unverified ones are visible in one place. Two constants were
not in the domain spec and come from model knowledge; both are marked FROM MODEL
KNOWLEDGE and head the verification checklist.

Age arithmetic uses ISO strings and integer months throughout. Passing an ISO
date to new Date() parses it as UTC, which shifts the day in negative offsets and
would put the 18 and 25 year cutoffs on the wrong side for part of the day.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Vermögensvergleich, dreiwertig

**Files:**
- Modify: `src/store/benefits/derive.ts`
- Modify: `src/store/benefits/derive.test.ts`

**Interfaces:**
- Consumes: `ASSET_ALLOWANCE_BY_AGE`, `ASSET_BAND_RANGE` (Task 2), `AssetsBand` (Task 1)
- Produces: `assetAllowance(ageYears: number): number`, `assetsVsAllowance(band: AssetsBand, allowance: number): AssetsComparison` mit `AssetsComparison = "BELOW" | "SPANS" | "ABOVE"`

- [ ] **Step 1: Write the failing test**

An `src/store/benefits/derive.test.ts` anhängen:

```ts
import { AssetsBand } from "../../schemas/benefitCheck.schema";
import { assetAllowance, assetsVsAllowance } from "./derive";

describe("assetAllowance", () => {
	it("staggers by age", () => {
		expect(assetAllowance(29)).toBe(5000);
		expect(assetAllowance(30)).toBe(10000);
		expect(assetAllowance(39)).toBe(10000);
		expect(assetAllowance(40)).toBe(12500);
		expect(assetAllowance(49)).toBe(12500);
		expect(assetAllowance(50)).toBe(20000);
		expect(assetAllowance(84)).toBe(20000);
	});
});

describe("assetsVsAllowance", () => {
	it("reports BELOW when the whole band is under the allowance", () => {
		expect(assetsVsAllowance(AssetsBand.UNDER_5000, 10000)).toBe("BELOW");
	});

	it("reports ABOVE when the whole band is at or over the allowance", () => {
		expect(assetsVsAllowance(AssetsBand.FROM_15000_TO_25000, 12500)).toBe(
			"ABOVE",
		);
		expect(assetsVsAllowance(AssetsBand.OVER_25000, 20000)).toBe("ABOVE");
	});

	it("reports SPANS when the band straddles the allowance", () => {
		// The domain spec's test case E: age 38 -> allowance 10000, assets 5000-15000.
		expect(assetsVsAllowance(AssetsBand.FROM_5000_TO_15000, 10000)).toBe(
			"SPANS",
		);
	});

	it("treats an allowance exactly on the upper bound as BELOW", () => {
		expect(assetsVsAllowance(AssetsBand.UNDER_5000, 5000)).toBe("BELOW");
	});

	it("treats an allowance exactly on the lower bound as ABOVE", () => {
		expect(assetsVsAllowance(AssetsBand.FROM_5000_TO_15000, 5000)).toBe(
			"ABOVE",
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/derive.test.ts`
Expected: FAIL — `assetAllowance is not a function`

- [ ] **Step 3: Write minimal implementation**

An `src/store/benefits/derive.ts` anhängen; den Import oben ergänzen:

```ts
import {
	ASSET_ALLOWANCE_BY_AGE,
	ASSET_BAND_RANGE,
	RETIREMENT_AGE_BY_BIRTH_YEAR,
} from "../../config/benefitRules.config";
import type { AssetsBand } from "../../schemas/benefitCheck.schema";
```

```ts
export const assetAllowance = (ageYears: number): number => {
	const bracket = ASSET_ALLOWANCE_BY_AGE.find(
		(candidate) => ageYears < candidate.maxAgeExclusive,
	);
	// The last bracket is unbounded, so `find` always hits.
	return bracket ? bracket.allowance : 0;
};

export type AssetsComparison = "BELOW" | "SPANS" | "ABOVE";

/**
 * Three-valued on purpose. The domain spec §5 returns a boolean built from the band's
 * lower bound and then explains in a comment that a band straddling the allowance is
 * an uncertain result — which a boolean cannot carry, so §6.1 rebuilds it from two
 * consecutive if-branches. Naming the third case here makes the uncertainty explicit
 * and lets test case E fall out of the function instead of out of branch ordering.
 */
export const assetsVsAllowance = (
	band: AssetsBand,
	allowance: number,
): AssetsComparison => {
	const { min, max } = ASSET_BAND_RANGE[band];
	if (max <= allowance) {
		return "BELOW";
	}
	if (min >= allowance) {
		return "ABOVE";
	}
	return "SPANS";
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/derive.test.ts`
Expected: PASS — 15 tests (kumulativ in derive.test.ts)

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/derive.ts src/store/benefits/derive.test.ts
git commit -m "$(cat <<'EOF'
feat: add three-valued asset comparison

The domain spec returns a boolean from the band's lower bound, then notes in a
comment that a band straddling the allowance is uncertain — which the boolean
cannot express, so the SGB II rule rebuilds it from two ordered if-branches.
BELOW/SPANS/ABOVE names the third case, so the uncertain outcome comes from the
comparison rather than from branch ordering.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Bedarf, Kinderfilter, Aufenthaltsvoraussetzung

**Files:**
- Modify: `src/store/benefits/derive.ts`
- Modify: `src/store/benefits/derive.test.ts`

**Interfaces:**
- Consumes: `STANDARD_NEEDS_BY_LEVEL` (Task 2), `ageInYears` (Task 2), `Household`, `PartialBenefitCheckAnswers`, `HouseholdComposition`, `Citizenship` (Task 1)
- Produces: `householdStandardNeeds(household: Household, today: string): number`, `totalNeeds(household: Household, monthlyWarmRent: number, today: string): number`, `minorChildren(household: Household, today: string): Array<{ dateOfBirth: string }>`, `childrenUnder25(household: Household, today: string): Array<{ dateOfBirth: string }>`, `isCouple(composition: HouseholdComposition): boolean`, `residenceRequirementMet(answers: PartialBenefitCheckAnswers): boolean | undefined`

- [ ] **Step 1: Write the failing test**

An `src/store/benefits/derive.test.ts` anhängen:

```ts
import {
	Citizenship,
	HouseholdComposition,
} from "../../schemas/benefitCheck.schema";
import {
	childrenUnder25,
	householdStandardNeeds,
	isCouple,
	minorChildren,
	residenceRequirementMet,
	totalNeeds,
} from "./derive";

const TODAY = "2026-09-09";

describe("householdStandardNeeds", () => {
	it("uses level 1 for a single adult", () => {
		expect(
			householdStandardNeeds(
				{ composition: HouseholdComposition.SINGLE, children: [] },
				TODAY,
			),
		).toBe(563);
	});

	it("uses level 2 twice for a couple", () => {
		expect(
			householdStandardNeeds(
				{ composition: HouseholdComposition.COUPLE_NO_CHILDREN, children: [] },
				TODAY,
			),
		).toBe(1012);
	});

	it("adds a level by child age band", () => {
		expect(
			householdStandardNeeds(
				{
					composition: HouseholdComposition.SINGLE_PARENT,
					children: [
						{ dateOfBirth: "2023-01-01" }, // 3 -> level 6, 357
						{ dateOfBirth: "2016-01-01" }, // 10 -> level 5, 390
						{ dateOfBirth: "2010-01-01" }, // 16 -> level 4, 471
						{ dateOfBirth: "2005-01-01" }, // 21 -> level 3, 451
					],
				},
				TODAY,
			),
		).toBe(563 + 357 + 390 + 471 + 451);
	});
});

describe("totalNeeds", () => {
	it("adds the warm rent to the standard needs", () => {
		expect(
			totalNeeds(
				{ composition: HouseholdComposition.SINGLE, children: [] },
				650,
				TODAY,
			),
		).toBe(1213);
	});
});

describe("child filters", () => {
	const household = {
		composition: HouseholdComposition.SINGLE_PARENT,
		children: [
			{ dateOfBirth: "2020-01-01" }, // 6
			{ dateOfBirth: "2008-09-09" }, // 18 exactly
			{ dateOfBirth: "2008-09-10" }, // 17
			{ dateOfBirth: "2001-09-09" }, // 25 exactly
		],
	};

	it("counts a child as a minor until the 18th birthday", () => {
		expect(minorChildren(household, TODAY)).toHaveLength(2);
	});

	it("excludes a child on their 25th birthday", () => {
		expect(childrenUnder25(household, TODAY)).toHaveLength(3);
	});
});

describe("isCouple", () => {
	it("is true for both couple compositions", () => {
		expect(isCouple(HouseholdComposition.COUPLE_NO_CHILDREN)).toBe(true);
		expect(isCouple(HouseholdComposition.COUPLE_WITH_CHILDREN)).toBe(true);
		expect(isCouple(HouseholdComposition.SINGLE)).toBe(false);
		expect(isCouple(HouseholdComposition.SINGLE_PARENT)).toBe(false);
	});
});

describe("residenceRequirementMet", () => {
	it("is met for German and EU citizens", () => {
		expect(residenceRequirementMet({ citizenship: Citizenship.DE_EU })).toBe(
			true,
		);
	});

	it("is met for non-EU citizens with a secure status", () => {
		expect(
			residenceRequirementMet({
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: true,
			}),
		).toBe(true);
	});

	it("is not met for non-EU citizens without a secure status", () => {
		expect(
			residenceRequirementMet({
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: false,
			}),
		).toBe(false);
	});

	it("is undefined while citizenship is unanswered", () => {
		expect(residenceRequirementMet({})).toBeUndefined();
	});

	it("is undefined while a non-EU applicant's status is unanswered", () => {
		expect(
			residenceRequirementMet({ citizenship: Citizenship.NON_EU }),
		).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/derive.test.ts`
Expected: FAIL — `householdStandardNeeds is not a function`

- [ ] **Step 3: Write minimal implementation**

Imports in `src/store/benefits/derive.ts` erweitern:

```ts
import {
	ASSET_ALLOWANCE_BY_AGE,
	ASSET_BAND_RANGE,
	RETIREMENT_AGE_BY_BIRTH_YEAR,
	STANDARD_NEEDS_BY_LEVEL,
} from "../../config/benefitRules.config";
import {
	Citizenship,
	HouseholdComposition,
} from "../../schemas/benefitCheck.schema";
import type {
	AssetsBand,
	Household,
	PartialBenefitCheckAnswers,
} from "../../schemas/benefitCheck.schema";
```

Anhängen:

```ts
export const isCouple = (composition: HouseholdComposition): boolean =>
	composition === HouseholdComposition.COUPLE_NO_CHILDREN ||
	composition === HouseholdComposition.COUPLE_WITH_CHILDREN;

/**
 * Which Regelbedarfsstufe a child falls into. The domain spec calls regelbedarf(haushalt)
 * without defining the mapping; this is the design doc's §5 assignment and is on the
 * verification checklist.
 */
const needsLevelForChildAge = (ageYears: number): 3 | 4 | 5 | 6 => {
	if (ageYears <= 5) {
		return 6;
	}
	if (ageYears <= 13) {
		return 5;
	}
	if (ageYears <= 17) {
		return 4;
	}
	return 3;
};

export const householdStandardNeeds = (
	household: Household,
	today: string,
): number => {
	const adults = isCouple(household.composition)
		? 2 * STANDARD_NEEDS_BY_LEVEL[2]
		: STANDARD_NEEDS_BY_LEVEL[1];
	return household.children.reduce(
		(sum, child) =>
			sum +
			STANDARD_NEEDS_BY_LEVEL[
				needsLevelForChildAge(ageInYears(child.dateOfBirth, today))
			],
		adults,
	);
};

export const totalNeeds = (
	household: Household,
	monthlyWarmRent: number,
	today: string,
): number => householdStandardNeeds(household, today) + monthlyWarmRent;

export const minorChildren = (
	household: Household,
	today: string,
): Array<{ dateOfBirth: string }> =>
	household.children.filter(
		(child) => ageInYears(child.dateOfBirth, today) < 18,
	);

export const childrenUnder25 = (
	household: Household,
	today: string,
): Array<{ dateOfBirth: string }> =>
	household.children.filter(
		(child) => ageInYears(child.dateOfBirth, today) < 25,
	);

/**
 * `undefined` means "not answered yet", which the rules turn into CHECK_ADVISED rather
 * than a rejection. Never collapse it to `false`.
 */
export const residenceRequirementMet = (
	answers: PartialBenefitCheckAnswers,
): boolean | undefined => {
	if (answers.citizenship === undefined) {
		return undefined;
	}
	if (answers.citizenship === Citizenship.DE_EU) {
		return true;
	}
	return answers.hasSecureResidenceStatus;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/derive.test.ts`
Expected: PASS — 27 tests (kumulativ in derive.test.ts)

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/derive.ts src/store/benefits/derive.test.ts
git commit -m "$(cat <<'EOF'
feat: add needs, child filters and residence derivation

householdStandardNeeds makes the member-to-Regelbedarfsstufe assignment explicit;
the domain spec calls regelbedarf(haushalt) without defining it, so this is a
design decision on the verification checklist.

residenceRequirementMet returns undefined for an unanswered question rather than
false, so an unanswered question cannot read as a rejection downstream.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Grundsicherungsgeld (SGB II)

**Files:**
- Create: `src/store/benefits/rules.ts`
- Test: `src/store/benefits/rules.test.ts`

**Interfaces:**
- Consumes: alles aus Tasks 1–4
- Produces: `assessSgbIiBasicIncome(answers: PartialBenefitCheckAnswers, today: string): BenefitAssessment`; intern `assessMeans(answers, today): { status: BenefitStatus; reasons: ReasonCode[] }`

- [ ] **Step 1: Write the failing test**

`src/store/benefits/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitId,
	BenefitStatus,
	Citizenship,
	HouseholdComposition,
	ReasonCode,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type { PartialBenefitCheckAnswers } from "../../schemas/benefitCheck.schema";
import { assessSgbIiBasicIncome } from "./rules";

const TODAY = "2026-09-09";

/** A 32-year-old single whose income falls short — the domain spec's case A. */
const CASE_A: PartialBenefitCheckAnswers = {
	dateOfBirth: "1994-01-15",
	workCapacity: WorkCapacity.FULL,
	household: { composition: HouseholdComposition.SINGLE, children: [] },
	employment: { isEmployed: true, monthlyGrossIncome: 1400 },
	monthlyNetHouseholdIncome: 1100,
	monthlyWarmRent: 650,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	livesInBerlin: true,
};

describe("assessSgbIiBasicIncome", () => {
	it("is likely for case A", () => {
		const result = assessSgbIiBasicIncome(CASE_A, TODAY);
		expect(result.benefit).toBe(BenefitId.SGB_II_BASIC_INCOME);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
		expect(result.reasons).toContain(ReasonCode.INCOME_BELOW_NEEDS);
		expect(result.reasons).toContain(ReasonCode.ASSETS_BELOW_ALLOWANCE);
	});

	it("is not applicable once the retirement age is reached", () => {
		const result = assessSgbIiBasicIncome(
			{ ...CASE_A, dateOfBirth: "1955-01-15" },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.RETIREMENT_AGE_REACHED]);
	});

	it("is not applicable when work capacity is not full", () => {
		const result = assessSgbIiBasicIncome(
			{ ...CASE_A, workCapacity: WorkCapacity.PERMANENTLY_REDUCED },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.WORK_CAPACITY_NOT_FULL]);
	});

	it("is doubtful when the residence status is not secure", () => {
		const result = assessSgbIiBasicIncome(
			{
				...CASE_A,
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: false,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.RESIDENCE_STATUS_UNCLEAR]);
	});

	it("is likely when benefits are already being received", () => {
		const result = assessSgbIiBasicIncome(
			{ ...CASE_A, receivesBenefitsAlready: true },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
		expect(result.reasons).toEqual([ReasonCode.ALREADY_RECEIVING_BENEFITS]);
	});

	it("is unlikely when income covers the needs", () => {
		const result = assessSgbIiBasicIncome(
			{ ...CASE_A, monthlyNetHouseholdIncome: 2500 },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.INCOME_COVERS_NEEDS]);
	});

	it("advises a check when the asset band straddles the allowance", () => {
		// Case E: 38 years old -> allowance 10000, band 5000-15000.
		const result = assessSgbIiBasicIncome(
			{
				...CASE_A,
				dateOfBirth: "1988-01-15",
				assetsBand: AssetsBand.FROM_5000_TO_15000,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toContain(ReasonCode.ASSETS_SPAN_ALLOWANCE);
	});

	it("is unlikely when assets are clearly above the allowance", () => {
		const result = assessSgbIiBasicIncome(
			{ ...CASE_A, assetsBand: AssetsBand.OVER_25000 },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.ASSETS_ABOVE_ALLOWANCE]);
	});

	it("advises a check rather than rejecting when answers are missing", () => {
		const result = assessSgbIiBasicIncome({}, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});

	it("advises a check when only the asset band is missing", () => {
		const { assetsBand: _dropped, ...withoutAssets } = CASE_A;
		const result = assessSgbIiBasicIncome(withoutAssets, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: FAIL — `Failed to resolve import "./rules"`

- [ ] **Step 3: Write minimal implementation**

`src/store/benefits/rules.ts`:

```ts
import {
	BenefitId,
	BenefitStatus,
	ReasonCode,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type {
	BenefitAssessment,
	PartialBenefitCheckAnswers,
} from "../../schemas/benefitCheck.schema";
import {
	assetAllowance,
	assetsVsAllowance,
	ageInYears,
	hasReachedRetirementAge,
	residenceRequirementMet,
	totalNeeds,
} from "./derive";

interface Verdict {
	status: BenefitStatus;
	reasons: ReasonCode[];
}

const INSUFFICIENT: Verdict = {
	status: BenefitStatus.CHECK_ADVISED,
	reasons: [ReasonCode.INSUFFICIENT_DATA],
};

/**
 * The income-and-assets test shared by the SGB II and SGB XII Kap. 4 rules, which the
 * domain spec §6.1 and §6.2 spell out identically.
 *
 * Note the ABOVE branch: the domain spec folds a clearly-over-allowance case into
 * "moeglich_pruefen" because its boolean helper cannot tell it apart from a straddling
 * band. With the three-valued comparison the two separate, and a clear overshoot reads
 * as LIKELY_NO.
 */
const assessMeans = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): Verdict => {
	if (
		answers.dateOfBirth === undefined ||
		answers.household === undefined ||
		answers.monthlyWarmRent === undefined ||
		answers.monthlyNetHouseholdIncome === undefined ||
		answers.assetsBand === undefined
	) {
		return INSUFFICIENT;
	}

	const needs = totalNeeds(answers.household, answers.monthlyWarmRent, today);
	if (answers.monthlyNetHouseholdIncome >= needs) {
		return {
			status: BenefitStatus.LIKELY_NO,
			reasons: [ReasonCode.INCOME_COVERS_NEEDS],
		};
	}

	const allowance = assetAllowance(ageInYears(answers.dateOfBirth, today));
	const assets = assetsVsAllowance(answers.assetsBand, allowance);

	if (assets === "BELOW") {
		return {
			status: BenefitStatus.LIKELY_YES,
			reasons: [ReasonCode.INCOME_BELOW_NEEDS, ReasonCode.ASSETS_BELOW_ALLOWANCE],
		};
	}
	if (assets === "SPANS") {
		return {
			status: BenefitStatus.CHECK_ADVISED,
			reasons: [ReasonCode.INCOME_BELOW_NEEDS, ReasonCode.ASSETS_SPAN_ALLOWANCE],
		};
	}
	return {
		status: BenefitStatus.LIKELY_NO,
		reasons: [ReasonCode.ASSETS_ABOVE_ALLOWANCE],
	};
};

export const assessSgbIiBasicIncome = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitAssessment => {
	const benefit = BenefitId.SGB_II_BASIC_INCOME;

	if (answers.dateOfBirth === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (hasReachedRetirementAge(answers.dateOfBirth, today)) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.RETIREMENT_AGE_REACHED],
		};
	}

	// Reachable only below the retirement age, which is exactly when the questionnaire
	// asks for work capacity. If the question order changes, this breaks silently.
	if (answers.workCapacity === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (answers.workCapacity !== WorkCapacity.FULL) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.WORK_CAPACITY_NOT_FULL],
		};
	}

	const residence = residenceRequirementMet(answers);
	if (residence === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (!residence) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_NO,
			reasons: [ReasonCode.RESIDENCE_STATUS_UNCLEAR],
		};
	}

	if (answers.receivesBenefitsAlready) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_YES,
			reasons: [ReasonCode.ALREADY_RECEIVING_BENEFITS],
		};
	}

	return { benefit, ...assessMeans(answers, today) };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: PASS — 10 tests

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/rules.ts src/store/benefits/rules.test.ts
git commit -m "$(cat <<'EOF'
feat: add SGB II basic income assessment

Follows the domain spec §6.1. Missing answers return CHECK_ADVISED with
INSUFFICIENT_DATA rather than LIKELY_NO, so an unanswered question never reads as
a rejection.

The shared means test distinguishes assets clearly above the allowance from a band
that straddles it; the domain spec folds both into "check advised" because its
boolean helper cannot tell them apart.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Grundsicherung im Alter und bei Erwerbsminderung (SGB XII Kap. 4)

**Files:**
- Modify: `src/store/benefits/rules.ts`
- Modify: `src/store/benefits/rules.test.ts`

**Interfaces:**
- Consumes: `assessMeans`, `INSUFFICIENT` (Task 5)
- Produces: `assessSgbXiiOldAgeReducedCapacity(answers: PartialBenefitCheckAnswers, today: string): BenefitAssessment`

- [ ] **Step 1: Write the failing test**

An `src/store/benefits/rules.test.ts` anhängen:

```ts
import { assessSgbXiiOldAgeReducedCapacity } from "./rules";

/** A 71-year-old on a small pension — the domain spec's case B. */
const CASE_B: PartialBenefitCheckAnswers = {
	dateOfBirth: "1955-03-20",
	household: { composition: HouseholdComposition.SINGLE, children: [] },
	employment: { isEmployed: false, monthlyGrossIncome: 0 },
	monthlyNetHouseholdIncome: 950,
	monthlyWarmRent: 550,
	assetsBand: AssetsBand.FROM_5000_TO_15000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	livesInBerlin: true,
};

describe("assessSgbXiiOldAgeReducedCapacity", () => {
	it("is likely for case B", () => {
		const result = assessSgbXiiOldAgeReducedCapacity(CASE_B, TODAY);
		expect(result.benefit).toBe(BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
		expect(result.reasons).toContain(ReasonCode.ASSETS_BELOW_ALLOWANCE);
	});

	it("applies below the retirement age when capacity is permanently reduced", () => {
		const result = assessSgbXiiOldAgeReducedCapacity(
			{
				...CASE_B,
				dateOfBirth: "1981-03-20",
				workCapacity: WorkCapacity.PERMANENTLY_REDUCED,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
	});

	it("does not apply to a working-age applicant with full capacity", () => {
		const result = assessSgbXiiOldAgeReducedCapacity(
			{
				...CASE_B,
				dateOfBirth: "1994-01-15",
				workCapacity: WorkCapacity.FULL,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.RETIREMENT_AGE_NOT_REACHED]);
	});

	it("does not apply to a temporarily reduced applicant below retirement age", () => {
		const result = assessSgbXiiOldAgeReducedCapacity(
			{
				...CASE_B,
				dateOfBirth: "1981-03-20",
				workCapacity: WorkCapacity.TEMPORARILY_REDUCED,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
	});

	it("does not apply below 18", () => {
		const result = assessSgbXiiOldAgeReducedCapacity(
			{
				...CASE_B,
				dateOfBirth: "2012-03-20",
				workCapacity: WorkCapacity.PERMANENTLY_REDUCED,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
	});

	it("advises a check when answers are missing", () => {
		const result = assessSgbXiiOldAgeReducedCapacity({}, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: FAIL — `assessSgbXiiOldAgeReducedCapacity is not a function`

- [ ] **Step 3: Write minimal implementation**

An `src/store/benefits/rules.ts` anhängen:

```ts
export const assessSgbXiiOldAgeReducedCapacity = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitAssessment => {
	const benefit = BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY;

	if (answers.dateOfBirth === undefined) {
		return { benefit, ...INSUFFICIENT };
	}

	const retired = hasReachedRetirementAge(answers.dateOfBirth, today);
	if (!retired && answers.workCapacity === undefined) {
		return { benefit, ...INSUFFICIENT };
	}

	const isAdult = ageInYears(answers.dateOfBirth, today) >= 18;
	const applies =
		isAdult &&
		(retired || answers.workCapacity === WorkCapacity.PERMANENTLY_REDUCED);

	if (!applies) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.RETIREMENT_AGE_NOT_REACHED],
		};
	}

	const residence = residenceRequirementMet(answers);
	if (residence === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (!residence) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_NO,
			reasons: [ReasonCode.RESIDENCE_STATUS_UNCLEAR],
		};
	}

	if (answers.receivesBenefitsAlready) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_YES,
			reasons: [ReasonCode.ALREADY_RECEIVING_BENEFITS],
		};
	}

	// The domain spec §6.2 flags an open question of whether SGB XII uses a different
	// asset allowance table than SGB II. Until that is answered, both share one table.
	return { benefit, ...assessMeans(answers, today) };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: PASS — 16 tests (kumulativ in rules.test.ts)

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/rules.ts src/store/benefits/rules.test.ts
git commit -m "$(cat <<'EOF'
feat: add SGB XII old-age and reduced-capacity assessment

Follows the domain spec §6.2. Shares the means test with the SGB II rule; the open
question of whether SGB XII uses a different asset allowance table is noted at the
call site.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Hilfe zum Lebensunterhalt (SGB XII Kap. 3)

**Files:**
- Modify: `src/store/benefits/rules.ts`
- Modify: `src/store/benefits/rules.test.ts`

**Interfaces:**
- Consumes: `INSUFFICIENT`, derive-Helfer
- Produces: `assessSgbXiiSubsistenceAid(answers: PartialBenefitCheckAnswers, today: string): BenefitAssessment`

- [ ] **Step 1: Write the failing test**

An `src/store/benefits/rules.test.ts` anhängen:

```ts
import { assessSgbXiiSubsistenceAid } from "./rules";

/** Temporarily unable to work at 45 — the domain spec's case D. The case gives no rent,
 *  so 500 is supplied here to make the needs test computable. */
const CASE_D: PartialBenefitCheckAnswers = {
	dateOfBirth: "1981-04-10",
	workCapacity: WorkCapacity.TEMPORARILY_REDUCED,
	household: { composition: HouseholdComposition.SINGLE, children: [] },
	employment: { isEmployed: false, monthlyGrossIncome: 0 },
	monthlyNetHouseholdIncome: 300,
	monthlyWarmRent: 500,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	livesInBerlin: true,
};

describe("assessSgbXiiSubsistenceAid", () => {
	it("is likely for case D", () => {
		const result = assessSgbXiiSubsistenceAid(CASE_D, TODAY);
		expect(result.benefit).toBe(BenefitId.SGB_XII_SUBSISTENCE_AID);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
	});

	it("does not apply to an applicant with full work capacity", () => {
		const result = assessSgbXiiSubsistenceAid(
			{ ...CASE_D, workCapacity: WorkCapacity.FULL },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.NOT_IN_CAPACITY_GAP]);
	});

	it("does not apply to a permanently reduced applicant", () => {
		const result = assessSgbXiiSubsistenceAid(
			{ ...CASE_D, workCapacity: WorkCapacity.PERMANENTLY_REDUCED },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
	});

	it("does not apply once the retirement age is reached", () => {
		const result = assessSgbXiiSubsistenceAid(
			{ ...CASE_D, dateOfBirth: "1955-04-10" },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
	});

	/**
	 * The domain spec §6.3 has no "income covers needs" exit: once the applicant is in
	 * the capacity gap, the fallthrough is "moeglich_pruefen", never "eher_nein".
	 */
	it("advises a check rather than rejecting when income covers the needs", () => {
		const result = assessSgbXiiSubsistenceAid(
			{ ...CASE_D, monthlyNetHouseholdIncome: 3000 },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toContain(ReasonCode.CAPACITY_GAP_PRECONDITION_MET);
	});

	it("advises a check when answers are missing", () => {
		const result = assessSgbXiiSubsistenceAid({}, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: FAIL — `assessSgbXiiSubsistenceAid is not a function`

- [ ] **Step 3: Write minimal implementation**

An `src/store/benefits/rules.ts` anhängen:

```ts
/**
 * Domain spec §6.3. Deliberately does NOT reuse `assessMeans`: once the applicant is in
 * the capacity gap, the spec's fallthrough is "check advised", never a rejection, so this
 * rule has no LIKELY_NO on the means test.
 */
export const assessSgbXiiSubsistenceAid = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitAssessment => {
	const benefit = BenefitId.SGB_XII_SUBSISTENCE_AID;

	if (answers.dateOfBirth === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (hasReachedRetirementAge(answers.dateOfBirth, today)) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NOT_IN_CAPACITY_GAP],
		};
	}
	if (answers.workCapacity === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (answers.workCapacity !== WorkCapacity.TEMPORARILY_REDUCED) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NOT_IN_CAPACITY_GAP],
		};
	}

	const residence = residenceRequirementMet(answers);
	if (residence === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (!residence) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_NO,
			reasons: [ReasonCode.RESIDENCE_STATUS_UNCLEAR],
		};
	}

	if (
		answers.household === undefined ||
		answers.monthlyWarmRent === undefined ||
		answers.monthlyNetHouseholdIncome === undefined ||
		answers.assetsBand === undefined
	) {
		return { benefit, ...INSUFFICIENT };
	}

	const needs = totalNeeds(answers.household, answers.monthlyWarmRent, today);
	const allowance = assetAllowance(ageInYears(answers.dateOfBirth, today));
	const assetsBelow =
		assetsVsAllowance(answers.assetsBand, allowance) === "BELOW";

	if (answers.monthlyNetHouseholdIncome < needs && assetsBelow) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_YES,
			reasons: [ReasonCode.INCOME_BELOW_NEEDS, ReasonCode.ASSETS_BELOW_ALLOWANCE],
		};
	}

	return {
		benefit,
		status: BenefitStatus.CHECK_ADVISED,
		reasons: [ReasonCode.CAPACITY_GAP_PRECONDITION_MET],
	};
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: PASS — 22 tests (kumulativ in rules.test.ts)

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/rules.ts src/store/benefits/rules.test.ts
git commit -m "$(cat <<'EOF'
feat: add SGB XII subsistence aid assessment

Follows the domain spec §6.3, which covers the gap between "able to work" and
"permanently unable". Does not reuse the shared means test on purpose: once the
applicant is in that gap the spec never rejects, it falls through to "check
advised".

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Wohngeld

**Files:**
- Modify: `src/store/benefits/rules.ts`
- Modify: `src/store/benefits/rules.test.ts`

**Interfaces:**
- Consumes: `RENT_BURDEN_THRESHOLD` (Task 2), `householdStandardNeeds` (Task 4)
- Produces: `assessHousingBenefit(answers: PartialBenefitCheckAnswers, today: string): BenefitAssessment`

- [ ] **Step 1: Write the failing test**

An `src/store/benefits/rules.test.ts` anhängen:

```ts
import { assessHousingBenefit } from "./rules";

describe("assessHousingBenefit", () => {
	/** Income covers subsistence, rent burden 700/1900 = 0.37. */
	const RENT_BURDENED: PartialBenefitCheckAnswers = {
		dateOfBirth: "1994-01-15",
		household: { composition: HouseholdComposition.SINGLE, children: [] },
		monthlyNetHouseholdIncome: 1900,
		monthlyWarmRent: 700,
		receivesBenefitsAlready: false,
		citizenship: Citizenship.DE_EU,
	};

	it("advises a check when income suffices but rent is heavy", () => {
		const result = assessHousingBenefit(RENT_BURDENED, TODAY);
		expect(result.benefit).toBe(BenefitId.HOUSING_BENEFIT);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toContain(ReasonCode.RENT_BURDEN_HIGH);
		expect(result.reasons).toContain(
			ReasonCode.EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA,
		);
	});

	it("does not apply while other benefits are received", () => {
		const result = assessHousingBenefit(
			{ ...RENT_BURDENED, receivesBenefitsAlready: true },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.BENEFITS_TAKE_PRECEDENCE]);
	});

	it("is unlikely when income does not even cover subsistence", () => {
		const result = assessHousingBenefit(
			{ ...RENT_BURDENED, monthlyNetHouseholdIncome: 400 },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.INCOME_BELOW_SUBSISTENCE]);
	});

	it("is unlikely when the rent burden is unremarkable", () => {
		const result = assessHousingBenefit(
			{ ...RENT_BURDENED, monthlyWarmRent: 400 },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.RENT_BURDEN_NORMAL]);
	});

	it("advises a check when answers are missing", () => {
		const result = assessHousingBenefit({}, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: FAIL — `assessHousingBenefit is not a function`

- [ ] **Step 3: Write minimal implementation**

Import in `src/store/benefits/rules.ts` ergänzen:

```ts
import { RENT_BURDEN_THRESHOLD } from "../../config/benefitRules.config";
```

Und `householdStandardNeeds` zum bestehenden `./derive`-Import hinzufügen. Dann anhängen:

```ts
/**
 * Domain spec §6.4. The rent-burden threshold is that document's own heuristic, not an
 * official figure; the real decision needs the Wohngeld formula (§19 WoGG, Mietstufe 4
 * for Berlin), which this pre-assessment does not implement.
 */
export const assessHousingBenefit = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitAssessment => {
	const benefit = BenefitId.HOUSING_BENEFIT;

	if (answers.receivesBenefitsAlready) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.BENEFITS_TAKE_PRECEDENCE],
		};
	}

	if (
		answers.household === undefined ||
		answers.monthlyWarmRent === undefined ||
		answers.monthlyNetHouseholdIncome === undefined
	) {
		return { benefit, ...INSUFFICIENT };
	}

	const needsWithoutRent = householdStandardNeeds(answers.household, today);
	if (answers.monthlyNetHouseholdIncome < needsWithoutRent) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_NO,
			reasons: [ReasonCode.INCOME_BELOW_SUBSISTENCE],
		};
	}

	const rentBurden =
		answers.monthlyWarmRent / Math.max(answers.monthlyNetHouseholdIncome, 1);
	if (rentBurden > RENT_BURDEN_THRESHOLD) {
		return {
			benefit,
			status: BenefitStatus.CHECK_ADVISED,
			reasons: [
				ReasonCode.RENT_BURDEN_HIGH,
				ReasonCode.EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA,
			],
		};
	}

	return {
		benefit,
		status: BenefitStatus.LIKELY_NO,
		reasons: [ReasonCode.RENT_BURDEN_NORMAL],
	};
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: PASS — 27 tests (kumulativ in rules.test.ts)

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/rules.ts src/store/benefits/rules.test.ts
git commit -m "$(cat <<'EOF'
feat: add Wohngeld assessment

Follows the domain spec §6.4, including the Nachrang rule that other benefits
exclude it. Never returns LIKELY_YES: the exact entitlement needs the official
formula, so the best this pre-assessment offers is CHECK_ADVISED with an explicit
reason code saying so.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Kinderzuschlag

**Files:**
- Modify: `src/store/benefits/rules.ts`
- Modify: `src/store/benefits/rules.test.ts`

**Interfaces:**
- Consumes: `KIZ_MIN_GROSS_INCOME` (Task 2), `childrenUnder25`, `isCouple` (Task 4)
- Produces: `assessChildSupplement(answers: PartialBenefitCheckAnswers, today: string): BenefitAssessment`

- [ ] **Step 1: Write the failing test**

An `src/store/benefits/rules.test.ts` anhängen:

```ts
import { assessChildSupplement } from "./rules";

/** Single parent, one child of 6, gross 1400 — the domain spec's case C. */
const CASE_C: PartialBenefitCheckAnswers = {
	dateOfBirth: "1997-05-02",
	workCapacity: WorkCapacity.FULL,
	household: {
		composition: HouseholdComposition.SINGLE_PARENT,
		children: [{ dateOfBirth: "2020-02-11" }],
	},
	employment: { isEmployed: true, monthlyGrossIncome: 1400 },
	monthlyNetHouseholdIncome: 1900,
	monthlyWarmRent: 700,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	childSupport: { receivesFullSupport: false, monthsWithoutSupport: 8 },
	livesInBerlin: true,
};

describe("assessChildSupplement", () => {
	it("advises a check for case C", () => {
		const result = assessChildSupplement(CASE_C, TODAY);
		expect(result.benefit).toBe(BenefitId.CHILD_SUPPLEMENT);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toContain(ReasonCode.KIZ_MIN_INCOME_MET);
		expect(result.reasons).toContain(
			ReasonCode.EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA,
		);
	});

	it("does not apply without children", () => {
		const result = assessChildSupplement(
			{
				...CASE_C,
				household: { composition: HouseholdComposition.SINGLE, children: [] },
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.NO_ELIGIBLE_CHILDREN]);
	});

	/**
	 * Corrects an error in the domain spec §6.5, which requires ALL children to be under
	 * 25 and therefore drops a household that also has an older child.
	 */
	it("still applies when one child is over 25 and another is not", () => {
		const result = assessChildSupplement(
			{
				...CASE_C,
				household: {
					composition: HouseholdComposition.SINGLE_PARENT,
					children: [
						{ dateOfBirth: "1999-01-01" }, // 27
						{ dateOfBirth: "2021-01-01" }, // 5
					],
				},
			},
			TODAY,
		);
		expect(result.status).not.toBe(BenefitStatus.NOT_APPLICABLE);
	});

	it("does not apply when every child is 25 or older", () => {
		const result = assessChildSupplement(
			{
				...CASE_C,
				household: {
					composition: HouseholdComposition.SINGLE_PARENT,
					children: [{ dateOfBirth: "1999-01-01" }],
				},
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
	});

	it("does not apply while other benefits are received", () => {
		const result = assessChildSupplement(
			{ ...CASE_C, receivesBenefitsAlready: true },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.BENEFITS_TAKE_PRECEDENCE]);
	});

	it("is unlikely below the minimum gross income for a single parent", () => {
		const result = assessChildSupplement(
			{
				...CASE_C,
				employment: { isEmployed: true, monthlyGrossIncome: 500 },
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.KIZ_MIN_INCOME_NOT_MET]);
	});

	it("applies the higher minimum to couples", () => {
		const couple: PartialBenefitCheckAnswers = {
			...CASE_C,
			household: {
				composition: HouseholdComposition.COUPLE_WITH_CHILDREN,
				children: [{ dateOfBirth: "2020-02-11" }],
			},
			employment: { isEmployed: true, monthlyGrossIncome: 700 },
		};
		expect(assessChildSupplement(couple, TODAY).status).toBe(
			BenefitStatus.LIKELY_NO,
		);
	});

	it("advises a check when answers are missing", () => {
		const result = assessChildSupplement({}, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: FAIL — `assessChildSupplement is not a function`

- [ ] **Step 3: Write minimal implementation**

Das Config-Import-Statement aus Task 8 **ersetzen** durch:

```ts
import {
	KIZ_MIN_GROSS_INCOME,
	RENT_BURDEN_THRESHOLD,
} from "../../config/benefitRules.config";
```

`childrenUnder25` und `isCouple` zum `./derive`-Import hinzufügen. Dann anhängen:

```ts
/**
 * Domain spec §6.5, with one correction: the spec requires ALL children to be under 25
 *
 *   hatKinder = kinder.length > 0 and alle(kinder, k -> k.alterJahre < 25)
 *
 * which drops a household containing both a 26-year-old and a 5-year-old, even though the
 * younger child qualifies. "At least one child under 25" is used instead.
 */
export const assessChildSupplement = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitAssessment => {
	const benefit = BenefitId.CHILD_SUPPLEMENT;

	if (answers.household === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (childrenUnder25(answers.household, today).length === 0) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NO_ELIGIBLE_CHILDREN],
		};
	}
	if (answers.receivesBenefitsAlready) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.BENEFITS_TAKE_PRECEDENCE],
		};
	}
	if (answers.employment === undefined) {
		return { benefit, ...INSUFFICIENT };
	}

	const minimum = isCouple(answers.household.composition)
		? KIZ_MIN_GROSS_INCOME.couple
		: KIZ_MIN_GROSS_INCOME.single;

	if (answers.employment.monthlyGrossIncome < minimum) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_NO,
			reasons: [ReasonCode.KIZ_MIN_INCOME_NOT_MET],
		};
	}

	return {
		benefit,
		status: BenefitStatus.CHECK_ADVISED,
		reasons: [
			ReasonCode.KIZ_MIN_INCOME_MET,
			ReasonCode.EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA,
		],
	};
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: PASS — 35 tests (kumulativ in rules.test.ts)

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/rules.ts src/store/benefits/rules.test.ts
git commit -m "$(cat <<'EOF'
feat: add Kinderzuschlag assessment

Follows the domain spec §6.5 with one correction. The spec requires every child in
the household to be under 25, which drops a household containing both a
26-year-old and a 5-year-old even though the younger child qualifies. This uses
"at least one child under 25" and covers the case with a test.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Unterhaltsvorschuss

**Files:**
- Modify: `src/store/benefits/rules.ts`
- Modify: `src/store/benefits/rules.test.ts`

**Interfaces:**
- Consumes: `minorChildren` (Task 4)
- Produces: `assessAdvanceMaintenance(answers: PartialBenefitCheckAnswers, today: string): BenefitAssessment`

- [ ] **Step 1: Write the failing test**

An `src/store/benefits/rules.test.ts` anhängen:

```ts
import { assessAdvanceMaintenance } from "./rules";

describe("assessAdvanceMaintenance", () => {
	it("is likely for case C", () => {
		const result = assessAdvanceMaintenance(CASE_C, TODAY);
		expect(result.benefit).toBe(BenefitId.ADVANCE_MAINTENANCE);
		expect(result.status).toBe(BenefitStatus.LIKELY_YES);
		expect(result.reasons).toContain(ReasonCode.CHILD_SUPPORT_INCOMPLETE);
	});

	it("does not apply to a couple", () => {
		const result = assessAdvanceMaintenance(
			{
				...CASE_C,
				household: {
					composition: HouseholdComposition.COUPLE_WITH_CHILDREN,
					children: [{ dateOfBirth: "2020-02-11" }],
				},
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.NOT_SINGLE_PARENT]);
	});

	it("does not apply without a minor child", () => {
		const result = assessAdvanceMaintenance(
			{
				...CASE_C,
				household: {
					composition: HouseholdComposition.SINGLE_PARENT,
					children: [{ dateOfBirth: "2005-01-01" }],
				},
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.NO_MINOR_CHILDREN]);
	});

	it("is unlikely when the child receives full support", () => {
		const result = assessAdvanceMaintenance(
			{
				...CASE_C,
				childSupport: { receivesFullSupport: true, monthsWithoutSupport: 0 },
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.LIKELY_NO);
		expect(result.reasons).toEqual([ReasonCode.CHILD_RECEIVES_FULL_SUPPORT]);
	});

	/**
	 * The domain spec §6.6 folds a missing `unterhalt` object into "eher_nein":
	 *
	 *   if not a.unterhalt or a.unterhalt.erhaeltVollenUnterhalt: -> eher_nein
	 *
	 * An unanswered question is not the same as "the child does receive support", so the
	 * two cases are split here.
	 */
	it("advises a check when the support question is unanswered", () => {
		const { childSupport: _dropped, ...withoutSupport } = CASE_C;
		const result = assessAdvanceMaintenance(withoutSupport, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});

	it("advises a check when answers are missing entirely", () => {
		const result = assessAdvanceMaintenance({}, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: FAIL — `assessAdvanceMaintenance is not a function`

- [ ] **Step 3: Write minimal implementation**

`minorChildren` zum bestehenden `./derive`-Import hinzufügen. `HouseholdComposition` in das
**bestehende** Value-Import-Statement aus `../../schemas/benefitCheck.schema` aufnehmen, das
seit Task 5 `BenefitId, BenefitStatus, ReasonCode, WorkCapacity` holt — es lautet danach:

```ts
import {
	BenefitId,
	BenefitStatus,
	HouseholdComposition,
	ReasonCode,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
```

Dann anhängen:

```ts
/**
 * Domain spec §6.6, with the missing-data rule applied. The spec writes
 *
 *   if not a.unterhalt or a.unterhalt.erhaeltVollenUnterhalt: -> eher_nein
 *
 * which treats an unanswered question as if the child were receiving support. The two are
 * split here: absent data yields CHECK_ADVISED, an actual "yes" yields LIKELY_NO.
 */
export const assessAdvanceMaintenance = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitAssessment => {
	const benefit = BenefitId.ADVANCE_MAINTENANCE;

	if (answers.household === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (answers.household.composition !== HouseholdComposition.SINGLE_PARENT) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NOT_SINGLE_PARENT],
		};
	}
	if (minorChildren(answers.household, today).length === 0) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NO_MINOR_CHILDREN],
		};
	}
	if (answers.childSupport === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (answers.childSupport.receivesFullSupport) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_NO,
			reasons: [ReasonCode.CHILD_RECEIVES_FULL_SUPPORT],
		};
	}

	return {
		benefit,
		status: BenefitStatus.LIKELY_YES,
		reasons: [ReasonCode.CHILD_SUPPORT_INCOMPLETE],
	};
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/rules.test.ts`
Expected: PASS — 41 tests (kumulativ in rules.test.ts)

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/rules.ts src/store/benefits/rules.test.ts
git commit -m "$(cat <<'EOF'
feat: add Unterhaltsvorschuss assessment

Follows the domain spec §6.6, splitting one branch. The spec folds a missing
support answer and an actual "child receives full support" into the same
rejection; an unanswered question now yields CHECK_ADVISED instead.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Aggregation und Hinweise

**Files:**
- Create: `src/store/benefits/evaluate.ts`
- Test: `src/store/benefits/evaluate.test.ts`

**Interfaces:**
- Consumes: alle sechs `assess*`-Funktionen (Tasks 5–10), `HintCode`, `BenefitCheckResult` (Task 1)
- Produces: `evaluateBenefitCheck(answers: PartialBenefitCheckAnswers, today: string): BenefitCheckResult`

- [ ] **Step 1: Write the failing test**

`src/store/benefits/evaluate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitId,
	BenefitStatus,
	Citizenship,
	HintCode,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type { PartialBenefitCheckAnswers } from "../../schemas/benefitCheck.schema";
import { evaluateBenefitCheck } from "./evaluate";

const TODAY = "2026-09-09";

const CASE_C: PartialBenefitCheckAnswers = {
	dateOfBirth: "1997-05-02",
	workCapacity: WorkCapacity.FULL,
	household: {
		composition: HouseholdComposition.SINGLE_PARENT,
		children: [{ dateOfBirth: "2020-02-11" }],
	},
	employment: { isEmployed: true, monthlyGrossIncome: 1400 },
	monthlyNetHouseholdIncome: 1900,
	monthlyWarmRent: 700,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	childSupport: { receivesFullSupport: false, monthsWithoutSupport: 8 },
	livesInBerlin: true,
};

describe("evaluateBenefitCheck", () => {
	it("always returns all six benefits in a stable order", () => {
		const result = evaluateBenefitCheck({}, TODAY);
		expect(result.assessments.map((a) => a.benefit)).toEqual([
			BenefitId.SGB_II_BASIC_INCOME,
			BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY,
			BenefitId.SGB_XII_SUBSISTENCE_AID,
			BenefitId.HOUSING_BENEFIT,
			BenefitId.CHILD_SUPPLEMENT,
			BenefitId.ADVANCE_MAINTENANCE,
		]);
	});

	it("never rejects on an empty answer set", () => {
		const result = evaluateBenefitCheck({}, TODAY);
		for (const assessment of result.assessments) {
			expect(assessment.status).not.toBe(BenefitStatus.LIKELY_NO);
		}
	});

	it("can return several live benefits at once", () => {
		const result = evaluateBenefitCheck(CASE_C, TODAY);
		const live = result.assessments.filter(
			(a) =>
				a.status === BenefitStatus.LIKELY_YES ||
				a.status === BenefitStatus.CHECK_ADVISED,
		);
		expect(live.map((a) => a.benefit)).toContain(BenefitId.ADVANCE_MAINTENANCE);
		expect(live.map((a) => a.benefit)).toContain(BenefitId.CHILD_SUPPLEMENT);
		expect(live.map((a) => a.benefit)).toContain(BenefitId.HOUSING_BENEFIT);
	});

	it("hints at the education package when a base benefit is live and children are present", () => {
		const result = evaluateBenefitCheck(CASE_C, TODAY);
		expect(result.hints).toContain(HintCode.EDUCATION_PARTICIPATION_PACKAGE);
	});

	it("hints at Kindergeld whenever children are present", () => {
		const result = evaluateBenefitCheck(CASE_C, TODAY);
		expect(result.hints).toContain(HintCode.CHILD_BENEFIT_PREREQUISITE);
	});

	it("omits child hints when there are no children", () => {
		const result = evaluateBenefitCheck(
			{
				...CASE_C,
				household: { composition: HouseholdComposition.SINGLE, children: [] },
			},
			TODAY,
		);
		expect(result.hints).not.toContain(HintCode.CHILD_BENEFIT_PREREQUISITE);
		expect(result.hints).not.toContain(
			HintCode.EDUCATION_PARTICIPATION_PACKAGE,
		);
	});

	it("refers to asylum benefits when the residence status is not secure", () => {
		const result = evaluateBenefitCheck(
			{
				...CASE_C,
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: false,
			},
			TODAY,
		);
		expect(result.hints).toContain(HintCode.ASYLUM_BENEFITS_REFERRAL);
	});

	it("does not refer to asylum benefits for EU citizens", () => {
		const result = evaluateBenefitCheck(CASE_C, TODAY);
		expect(result.hints).not.toContain(HintCode.ASYLUM_BENEFITS_REFERRAL);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/evaluate.test.ts`
Expected: FAIL — `Failed to resolve import "./evaluate"`

- [ ] **Step 3: Write minimal implementation**

`src/store/benefits/evaluate.ts`:

```ts
import {
	BenefitId,
	BenefitStatus,
	Citizenship,
	HintCode,
} from "../../schemas/benefitCheck.schema";
import type {
	BenefitAssessment,
	BenefitCheckResult,
	PartialBenefitCheckAnswers,
} from "../../schemas/benefitCheck.schema";
import {
	assessAdvanceMaintenance,
	assessChildSupplement,
	assessHousingBenefit,
	assessSgbIiBasicIncome,
	assessSgbXiiOldAgeReducedCapacity,
	assessSgbXiiSubsistenceAid,
} from "./rules";

/** The five benefits whose entitlement opens the Bildungs- und Teilhabepaket. */
const BASE_BENEFITS: readonly BenefitId[] = [
	BenefitId.SGB_II_BASIC_INCOME,
	BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY,
	BenefitId.SGB_XII_SUBSISTENCE_AID,
	BenefitId.HOUSING_BENEFIT,
	BenefitId.CHILD_SUPPLEMENT,
];

const isLive = (assessment: BenefitAssessment): boolean =>
	assessment.status === BenefitStatus.LIKELY_YES ||
	assessment.status === BenefitStatus.CHECK_ADVISED;

/**
 * Domain spec §7. The disclaimer is deliberately NOT part of this result: it is an i18n
 * key the result view renders unconditionally, so it cannot go missing because the engine
 * forgot to attach it.
 */
export const evaluateBenefitCheck = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitCheckResult => {
	const assessments: BenefitAssessment[] = [
		assessSgbIiBasicIncome(answers, today),
		assessSgbXiiOldAgeReducedCapacity(answers, today),
		assessSgbXiiSubsistenceAid(answers, today),
		assessHousingBenefit(answers, today),
		assessChildSupplement(answers, today),
		assessAdvanceMaintenance(answers, today),
	];

	const hints: HintCode[] = [];
	const hasChildren = (answers.household?.children.length ?? 0) > 0;
	const baseBenefitLive = assessments.some(
		(assessment) =>
			BASE_BENEFITS.includes(assessment.benefit) && isLive(assessment),
	);

	if (hasChildren && baseBenefitLive) {
		hints.push(HintCode.EDUCATION_PARTICIPATION_PACKAGE);
	}
	if (hasChildren) {
		hints.push(HintCode.CHILD_BENEFIT_PREREQUISITE);
	}
	if (
		answers.citizenship === Citizenship.NON_EU &&
		answers.hasSecureResidenceStatus === false
	) {
		hints.push(HintCode.ASYLUM_BENEFITS_REFERRAL);
	}

	return { assessments, hints };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/evaluate.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/evaluate.ts src/store/benefits/evaluate.test.ts
git commit -m "$(cat <<'EOF'
feat: add benefit check aggregation and hints

Follows the domain spec §7. Always returns all six assessments in a stable order
so the result view can render them positionally.

The disclaimer is not part of the result: it is an i18n key the view renders
unconditionally, so it cannot go missing because the engine failed to attach it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Abnahmetests der Fachspec

**Files:**
- Create: `src/store/benefits/acceptance.test.ts`

**Interfaces:**
- Consumes: `evaluateBenefitCheck` (Task 11)
- Produces: nichts (nur Tests)

Diese Task ist die Abnahmebedingung für Teil A. Sie kodiert die fünf Fälle aus Fachspec §9
gegen das aggregierte Ergebnis, nicht gegen einzelne Funktionen.

- [ ] **Step 1: Write the failing test**

`src/store/benefits/acceptance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitId,
	BenefitStatus,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type {
	BenefitId as BenefitIdType,
	BenefitStatus as BenefitStatusType,
	PartialBenefitCheckAnswers,
} from "../../schemas/benefitCheck.schema";
import { evaluateBenefitCheck } from "./evaluate";

/**
 * The five cases from section 9 of leistungscheck-agent-spezifikation.md.
 *
 * `today` is pinned so ages stay fixed as the calendar moves. Where the domain spec
 * leaves a value unspecified (case D gives no rent), the fixture supplies one and says so.
 */
const TODAY = "2026-09-09";

const statusOf = (
	answers: PartialBenefitCheckAnswers,
	benefit: BenefitIdType,
): BenefitStatusType => {
	const result = evaluateBenefitCheck(answers, TODAY);
	const assessment = result.assessments.find((a) => a.benefit === benefit);
	if (!assessment) {
		throw new Error(`no assessment for ${benefit}`);
	}
	return assessment.status;
};

describe("domain spec §9 acceptance cases", () => {
	it("case A: single, employed, tight — SGB II likely", () => {
		const caseA: PartialBenefitCheckAnswers = {
			dateOfBirth: "1994-01-15", // 32
			workCapacity: WorkCapacity.FULL,
			household: { composition: HouseholdComposition.SINGLE, children: [] },
			employment: { isEmployed: true, monthlyGrossIncome: 1400 },
			monthlyNetHouseholdIncome: 1100,
			monthlyWarmRent: 650,
			assetsBand: AssetsBand.UNDER_5000,
			receivesBenefitsAlready: false,
			citizenship: Citizenship.DE_EU,
			livesInBerlin: true,
		};
		expect(statusOf(caseA, BenefitId.SGB_II_BASIC_INCOME)).toBe(
			BenefitStatus.LIKELY_YES,
		);
	});

	it("case B: pensioner on a small pension — SGB XII likely, SGB II not applicable", () => {
		const caseB: PartialBenefitCheckAnswers = {
			dateOfBirth: "1955-03-20", // 71
			household: { composition: HouseholdComposition.SINGLE, children: [] },
			employment: { isEmployed: false, monthlyGrossIncome: 0 },
			monthlyNetHouseholdIncome: 950,
			monthlyWarmRent: 550,
			assetsBand: AssetsBand.FROM_5000_TO_15000, // 8000
			receivesBenefitsAlready: false,
			citizenship: Citizenship.DE_EU,
			livesInBerlin: true,
		};
		expect(statusOf(caseB, BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY)).toBe(
			BenefitStatus.LIKELY_YES,
		);
		expect(statusOf(caseB, BenefitId.SGB_II_BASIC_INCOME)).toBe(
			BenefitStatus.NOT_APPLICABLE,
		);
	});

	it("case C: single parent, no maintenance — UVG likely, KiZ worth checking", () => {
		const caseC: PartialBenefitCheckAnswers = {
			dateOfBirth: "1997-05-02", // 29
			workCapacity: WorkCapacity.FULL,
			household: {
				composition: HouseholdComposition.SINGLE_PARENT,
				children: [{ dateOfBirth: "2020-02-11" }], // 6
			},
			employment: { isEmployed: true, monthlyGrossIncome: 1400 },
			monthlyNetHouseholdIncome: 1900,
			monthlyWarmRent: 700,
			assetsBand: AssetsBand.UNDER_5000,
			receivesBenefitsAlready: false,
			citizenship: Citizenship.DE_EU,
			childSupport: { receivesFullSupport: false, monthsWithoutSupport: 8 },
			livesInBerlin: true,
		};
		expect(statusOf(caseC, BenefitId.ADVANCE_MAINTENANCE)).toBe(
			BenefitStatus.LIKELY_YES,
		);
		expect(statusOf(caseC, BenefitId.CHILD_SUPPLEMENT)).toBe(
			BenefitStatus.CHECK_ADVISED,
		);
	});

	it("case D: temporarily unable to work — HLU likely, the other two not applicable", () => {
		const caseD: PartialBenefitCheckAnswers = {
			dateOfBirth: "1981-04-10", // 45
			workCapacity: WorkCapacity.TEMPORARILY_REDUCED,
			household: { composition: HouseholdComposition.SINGLE, children: [] },
			employment: { isEmployed: false, monthlyGrossIncome: 0 },
			monthlyNetHouseholdIncome: 300,
			monthlyWarmRent: 500, // not given by the domain spec; supplied for the needs test
			assetsBand: AssetsBand.UNDER_5000,
			receivesBenefitsAlready: false,
			citizenship: Citizenship.DE_EU,
			livesInBerlin: true,
		};
		expect(statusOf(caseD, BenefitId.SGB_XII_SUBSISTENCE_AID)).toBe(
			BenefitStatus.LIKELY_YES,
		);
		expect(statusOf(caseD, BenefitId.SGB_II_BASIC_INCOME)).toBe(
			BenefitStatus.NOT_APPLICABLE,
		);
		expect(statusOf(caseD, BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY)).toBe(
			BenefitStatus.NOT_APPLICABLE,
		);
	});

	it("case E: asset band straddles the allowance — SGB II worth checking", () => {
		const caseE: PartialBenefitCheckAnswers = {
			dateOfBirth: "1988-01-15", // 38 -> allowance 10000
			workCapacity: WorkCapacity.FULL,
			household: { composition: HouseholdComposition.SINGLE, children: [] },
			employment: { isEmployed: true, monthlyGrossIncome: 1200 },
			monthlyNetHouseholdIncome: 1000,
			monthlyWarmRent: 600,
			assetsBand: AssetsBand.FROM_5000_TO_15000,
			receivesBenefitsAlready: false,
			citizenship: Citizenship.DE_EU,
			livesInBerlin: true,
		};
		expect(statusOf(caseE, BenefitId.SGB_II_BASIC_INCOME)).toBe(
			BenefitStatus.CHECK_ADVISED,
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run src/store/benefits/acceptance.test.ts`
Expected: PASS — 5 tests. Anders als bei den Tasks vorher ist hier kein roter Zwischenschritt zu erwarten: die Implementierung existiert schon, dieser Test prüft sie gegen die Fachspec. Schlägt er fehl, ist eine der Tasks 5–11 falsch — dann dort korrigieren, nicht den Test anpassen.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: `Tests  1 failed | 356 passed (357)` — der eine Fehlschlag ist der vorbestehende `ApplicationOverview.test.tsx`. Die genaue Zahl der grünen Tests kann abweichen, wenn frühere Tasks Tests ergänzt haben; entscheidend ist: **exakt ein roter Test, und zwar dieser.**

- [ ] **Step 4: Typecheck and lint the new files**

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe

Run: `npx eslint src/schemas/benefitCheck.schema.ts src/config/benefitRules.config.ts src/store/benefits/`
Expected: keine Ausgabe

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/acceptance.test.ts
git commit -m "$(cat <<'EOF'
test: add domain spec acceptance cases for the benefit check

Encodes the five cases from section 9 of the domain spec against the aggregated
result rather than individual rules, so they keep holding if the internal
decomposition changes.

today is pinned so ages do not drift with the calendar. Case D leaves the rent
unspecified in the domain spec; the fixture supplies 500 and says so at the call
site.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Korrekturen aus der Umsetzung

Zwei Fehler im Plan, die erst beim Ausführen aufgefallen sind:

1. **Task 6, Test „applies below the retirement age when capacity is permanently reduced"**
   erwartete `LIKELY_YES`, während Fall B's Vermögensband (5.000–15.000) bei 45 Jahren den
   Freibetrag von 12.500 überspannt und korrekt `CHECK_ADVISED` liefert. Der Test prüft die
   Zuständigkeit, nicht die Vermögensrechnung, und nutzt jetzt `UNDER_5000`. Fehler im Test,
   nicht in der Implementierung.
2. **`RETIREMENT_AGE_BY_BIRTH_YEAR` war als Funktion mit Konstanten-Namen geschrieben** und
   verstieß gegen die `new-cap`-Lint-Regel. Umbenannt zu `retirementAgeForBirthYear`.

Die Testzahlen in den Tasks waren teils zu hoch geschätzt und sind auf die tatsächlichen
Werte korrigiert.

---

## Abschluss

Nach Task 12 ist Teil A fertig: sechs Bewertungsfunktionen, gegen die Fachspec-Fälle
verifiziert, ohne eine Zeile UI und ohne Änderung an bestehendem Code.

**Nicht Teil dieses Plans, bewusst offen:**

- `src/schemas/eligibility.schema.ts`, `EligibilityEngine.ts` und dessen Test bleiben
  unverändert im Baum. Sie werden in Teil B entfernt, wenn der Fragebogen umgestellt ist.
- Die vier Datenpunkte ohne Datenbankfeld (`employment.monthlyGrossIncome`, `assetsBand`,
  `childSupport.receivesFullSupport`, `childSupport.monthsWithoutSupport`) werden von
  Teil A erhoben und verrechnet, aber erst in Teil C beim Profil-Sync relevant. Dort
  werden sie mit `// GAP:` markiert weggelassen, bis das Backend nachzieht.
- `livesInBerlin` wird im Antwortmodell geführt, aber von keiner der sechs Funktionen
  gelesen — die Fachspec nutzt es nicht in §6. Es bleibt drin, weil Teil C es auf
  `city` / `zip_code` abbilden kann.
- **`liegtImKinderzuschlagKorridor` aus Fachspec §5 wird nicht implementiert.** Die
  Funktion existiert dort nur, um die Skip-Bedingung von Frage 10 zu bedienen, und
  referenziert die Höchsteinkommensgrenze — eine Größe, die §6.5 selbst für nicht
  berechenbar erklärt und an die amtliche Formel verweist. Teil B stellt Frage 10
  stattdessen immer, wenn Kinder im Haushalt sind. Wer den Plan gegen die Fachspec
  abgleicht, findet die Funktion also absichtlich nicht.
