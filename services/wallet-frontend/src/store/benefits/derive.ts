import {
	ASSET_ALLOWANCE_BY_AGE,
	ASSET_BAND_RANGE,
	STANDARD_NEEDS_BY_LEVEL,
	retirementAgeForBirthYear,
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
	const { years, months } = retirementAgeForBirthYear(birthYear);
	return ageInMonths(dateOfBirth, today) >= years * 12 + months;
};

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
