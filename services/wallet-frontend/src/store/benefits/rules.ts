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
	KIZ_MIN_GROSS_INCOME,
	RENT_BURDEN_THRESHOLD,
} from "../../config/benefitRules.config";
import {
	ageInYears,
	assetAllowance,
	assetsVsAllowance,
	childrenUnder25,
	hasReachedRetirementAge,
	householdStandardNeeds,
	isCouple,
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
			reasons: [
				ReasonCode.INCOME_BELOW_NEEDS,
				ReasonCode.ASSETS_BELOW_ALLOWANCE,
			],
		};
	}

	return {
		benefit,
		status: BenefitStatus.CHECK_ADVISED,
		reasons: [ReasonCode.CAPACITY_GAP_PRECONDITION_MET],
	};
};

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
