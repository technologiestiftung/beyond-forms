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
	ageInYears,
	assetAllowance,
	assetsVsAllowance,
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
			reasons: [
				ReasonCode.INCOME_BELOW_NEEDS,
				ReasonCode.ASSETS_BELOW_ALLOWANCE,
			],
		};
	}
	if (assets === "SPANS") {
		return {
			status: BenefitStatus.CHECK_ADVISED,
			reasons: [
				ReasonCode.INCOME_BELOW_NEEDS,
				ReasonCode.ASSETS_SPAN_ALLOWANCE,
			],
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
