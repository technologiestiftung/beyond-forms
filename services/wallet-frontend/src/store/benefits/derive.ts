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
