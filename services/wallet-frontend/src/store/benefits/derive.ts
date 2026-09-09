import {
	ASSET_ALLOWANCE_BY_AGE,
	ASSET_BAND_RANGE,
	RETIREMENT_AGE_BY_BIRTH_YEAR,
} from "../../config/benefitRules.config";
import type { AssetsBand } from "../../schemas/benefitCheck.schema";

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
