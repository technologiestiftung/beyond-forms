import {
	type EligibilityCheck,
	AssetsBand,
	Binary,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
	localDateToday,
} from "../schemas/eligibility.schema";

/** Regelbedarfsstufen 1–6, 2026 */
const REGELBEDARF = {
	single: 563,
	partner: 506,
	adultChild: 451,
	age14to17: 471,
	age6to13: 390,
	age0to5: 357,
} as const;

/** SGB II Schonvermögen per adult, by age, from 1 July 2026 */
const SGB_II_ALLOWANCE_BY_AGE = [
	{ maxAge: 30, amount: 5_000 },
	{ maxAge: 40, amount: 10_000 },
	{ maxAge: 50, amount: 12_500 },
	{ maxAge: Infinity, amount: 20_000 },
] as const;

/** SGB XII Schonvermögen per adult */
const SGB_XII_ALLOWANCE = 10_000;

/** Kinderzuschlag minimum gross income */
const KIZ_MIN_GROSS = { singleParent: 600, couple: 900 } as const;

/** Not a legal threshold: above this rent share, Wohngeld is worth checking */
const WOHNGELD_RENT_SHARE = 0.3;

const ASSET_BAND_RANGE: Record<AssetsBand, { min: number; max: number }> = {
	[AssetsBand.UNDER_5000]: { min: 0, max: 5_000 },
	[AssetsBand.FROM_5000_TO_10000]: { min: 5_000, max: 10_000 },
	[AssetsBand.FROM_10000_TO_12500]: { min: 10_000, max: 12_500 },
	[AssetsBand.FROM_12500_TO_20000]: { min: 12_500, max: 20_000 },
	[AssetsBand.OVER_20000]: { min: 20_000, max: Infinity },
};

export const Benefit = {
	GRUNDSICHERUNGSGELD: "GRUNDSICHERUNGSGELD",
	GRUNDSICHERUNG_ALTER: "GRUNDSICHERUNG_ALTER",
	WOHNGELD: "WOHNGELD",
	KINDERZUSCHLAG: "KINDERZUSCHLAG",
} as const;

export type Benefit = (typeof Benefit)[keyof typeof Benefit];

export const BenefitStatus = {
	LIKELY: "LIKELY",
	POSSIBLE: "POSSIBLE",
	NO: "NO",
} as const;

export type BenefitStatus = (typeof BenefitStatus)[keyof typeof BenefitStatus];

export interface BenefitAssessment {
	benefit: Benefit;
	status: BenefitStatus;
	/** Key under `outcome.reasons` in the eligibility copy. */
	reason: string;
}

type Answers = Partial<EligibilityCheck>;

const ageOn = (dateOfBirth: string, today: string): number => {
	const [by, bm, bd] = dateOfBirth.split("-").map(Number);
	const [ty, tm, td] = today.split("-").map(Number);
	return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
};

/** Regelaltersgrenze in months, § 235 SGB VI */
const retirementAgeInMonths = (birthYear: number): number => {
	if (birthYear <= 1946) {
		return 65 * 12;
	}
	if (birthYear <= 1958) {
		return 65 * 12 + (birthYear - 1946);
	}
	if (birthYear <= 1963) {
		return 66 * 12 + (birthYear - 1958) * 2;
	}
	return 67 * 12;
};

export const hasReachedRetirementAge = (
	dateOfBirth: string,
	today: string = localDateToday(),
): boolean => {
	const [by, bm, bd] = dateOfBirth.split("-").map(Number);
	const [ty, tm, td] = today.split("-").map(Number);
	const monthsOld = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
	return monthsOld >= retirementAgeInMonths(by);
};

const isCouple = (a: Answers) =>
	a.householdComposition === HouseholdComposition.COUPLE_NO_CHILDREN ||
	a.householdComposition === HouseholdComposition.COUPLE_WITH_CHILDREN;

const hasChildren = (a: Answers) =>
	a.householdComposition === HouseholdComposition.SINGLE_PARENT ||
	a.householdComposition === HouseholdComposition.COUPLE_WITH_CHILDREN;

const childAges = (a: Answers, today: string): number[] =>
	hasChildren(a)
		? (a.children ?? []).map((c) => ageOn(c.dateOfBirth, today))
		: [];

const childRegelbedarf = (age: number): number => {
	if (age < 6) {
		return REGELBEDARF.age0to5;
	}
	if (age < 14) {
		return REGELBEDARF.age6to13;
	}
	if (age < 18) {
		return REGELBEDARF.age14to17;
	}
	return REGELBEDARF.adultChild;
};

const regelbedarf = (a: Answers, today: string): number =>
	(isCouple(a) ? 2 * REGELBEDARF.partner : REGELBEDARF.single) +
	childAges(a, today).reduce((sum, age) => sum + childRegelbedarf(age), 0);

/** Compares the household's net income with Regelbedarf plus rent, then savings with the allowance */
const meansTest = (
	a: Answers,
	today: string,
	allowance: number,
): Pick<BenefitAssessment, "status" | "reason"> => {
	const needs = regelbedarf(a, today) + (a.monthlyWarmRent ?? 0);
	if ((a.monthlyNetHouseholdIncome ?? 0) >= needs) {
		return { status: BenefitStatus.NO, reason: "income_covers_needs" };
	}
	const band = ASSET_BAND_RANGE[a.assetsBand ?? AssetsBand.UNDER_5000];
	if (band.min >= allowance) {
		return { status: BenefitStatus.NO, reason: "assets_too_high" };
	}
	if (band.max > allowance) {
		return { status: BenefitStatus.POSSIBLE, reason: "assets_near_limit" };
	}
	return { status: BenefitStatus.LIKELY, reason: "income_below_needs" };
};

const adults = (a: Answers) => (isCouple(a) ? 2 : 1);

const assessGrundsicherungsgeld = (
	a: Answers,
	today: string,
	retired: boolean,
) => {
	if (retired) {
		return { status: BenefitStatus.NO, reason: "retirement_age_reached" };
	}
	if (a.workCapacity === WorkCapacity.PERMANENTLY_REDUCED) {
		return { status: BenefitStatus.NO, reason: "permanently_unable_to_work" };
	}
	const age = ageOn(a.dateOfBirth ?? today, today);
	const perAdult =
		SGB_II_ALLOWANCE_BY_AGE.find((tier) => age <= tier.maxAge)?.amount ?? 0;
	const result = meansTest(a, today, perAdult * adults(a));
	// Whether "not at the moment" means under or over six months decides between SGB II and SGB XII
	if (
		a.workCapacity === WorkCapacity.TEMPORARILY_REDUCED &&
		result.status === BenefitStatus.LIKELY
	) {
		return {
			status: BenefitStatus.POSSIBLE,
			reason: "temporarily_unable_to_work",
		};
	}
	return result;
};

const assessGrundsicherungAlter = (
	a: Answers,
	today: string,
	retired: boolean,
) => {
	const isAdult = ageOn(a.dateOfBirth ?? today, today) >= 18;
	if (
		!retired &&
		!(isAdult && a.workCapacity === WorkCapacity.PERMANENTLY_REDUCED)
	) {
		return {
			status: BenefitStatus.NO,
			reason: "not_retired_nor_unable_to_work",
		};
	}
	return meansTest(a, today, SGB_XII_ALLOWANCE * adults(a));
};

const assessWohngeld = (a: Answers, today: string) => {
	const net = a.monthlyNetHouseholdIncome ?? 0;
	if (net < regelbedarf(a, today)) {
		return { status: BenefitStatus.NO, reason: "income_too_low_for_wohngeld" };
	}
	if ((a.monthlyWarmRent ?? 0) > net * WOHNGELD_RENT_SHARE) {
		return { status: BenefitStatus.POSSIBLE, reason: "high_rent_share" };
	}
	return { status: BenefitStatus.NO, reason: "low_rent_share" };
};

const assessKinderzuschlag = (a: Answers, today: string) => {
	if (!childAges(a, today).some((age) => age < 25)) {
		return { status: BenefitStatus.NO, reason: "no_children" };
	}
	const minimum = isCouple(a)
		? KIZ_MIN_GROSS.couple
		: KIZ_MIN_GROSS.singleParent;
	if ((a.monthlyGrossIncome ?? 0) < minimum) {
		return { status: BenefitStatus.NO, reason: "gross_below_minimum" };
	}
	return { status: BenefitStatus.POSSIBLE, reason: "gross_above_minimum" };
};

/** Needs a residence title the answers could not confirm, see the asylum hint on the result page */
export const needsResidenceHint = (a: Answers): boolean =>
	a.citizenship === Citizenship.NON_EU &&
	a.hasSecureResidenceStatus !== Binary.YES;

export const assessBenefits = (
	answers: Answers,
	today: string = localDateToday(),
): BenefitAssessment[] => {
	const retired =
		answers.dateOfBirth !== undefined &&
		hasReachedRetirementAge(answers.dateOfBirth, today);

	const assessments: BenefitAssessment[] = [
		{
			benefit: Benefit.GRUNDSICHERUNGSGELD,
			...assessGrundsicherungsgeld(answers, today, retired),
		},
		{
			benefit: Benefit.GRUNDSICHERUNG_ALTER,
			...assessGrundsicherungAlter(answers, today, retired),
		},
		{ benefit: Benefit.WOHNGELD, ...assessWohngeld(answers, today) },
		{
			benefit: Benefit.KINDERZUSCHLAG,
			...assessKinderzuschlag(answers, today),
		},
	];

	return assessments.map((assessment) => {
		if (
			answers.receivesBenefits === Binary.YES &&
			assessment.status === BenefitStatus.LIKELY
		) {
			// Some benefits exclude each other, so an existing one makes any new claim uncertain
			return {
				...assessment,
				status: BenefitStatus.POSSIBLE,
				reason: "already_receives_benefits",
			};
		}
		if (
			needsResidenceHint(answers) &&
			assessment.status === BenefitStatus.LIKELY
		) {
			return {
				...assessment,
				status: BenefitStatus.POSSIBLE,
				reason: "residence_status_unclear",
			};
		}
		return assessment;
	});
};
