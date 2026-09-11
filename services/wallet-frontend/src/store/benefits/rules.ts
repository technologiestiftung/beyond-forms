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
	compositionImpliesChildren,
	hasReachedRetirementAge,
	householdStandardNeeds,
	isCouple,
	residenceRequirementMet,
	totalNeeds,
} from "./derive";
import type { Household } from "./derive";

interface Verdict {
	status: BenefitStatus;
	reasons: ReasonCode[];
}

const INSUFFICIENT: Verdict = {
	status: BenefitStatus.CHECK_ADVISED,
	reasons: [ReasonCode.INSUFFICIENT_DATA],
};

/** The income-and-assets test shared by the SGB II and SGB XII Kap. 4 rules. */
const assessMeans = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): Verdict => {
	if (
		answers.dateOfBirth === undefined ||
		answers.householdComposition === undefined ||
		answers.children === undefined ||
		answers.monthlyWarmRent === undefined ||
		answers.monthlyNetHouseholdIncome === undefined ||
		answers.assetsBand === undefined
	) {
		return INSUFFICIENT;
	}

	const household: Household = {
		composition: answers.householdComposition,
		children: answers.children,
	};
	const needs = totalNeeds(household, answers.monthlyWarmRent, today);
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

	// `allowance` covers the applicant alone, because the partner's age is never asked.
	// SGB II grants one allowance per member of the Bedarfsgemeinschaft, so a couple's real
	// allowance is up to double and a clear overshoot of the single figure is not a
	// rejection. BELOW needs no such care: below the smaller figure is below the larger one.
	if (isCouple(answers.householdComposition)) {
		return {
			status: BenefitStatus.CHECK_ADVISED,
			reasons: [
				ReasonCode.INCOME_BELOW_NEEDS,
				ReasonCode.COUPLE_ASSET_ALLOWANCE_UNKNOWN,
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

	// Whether SGB XII uses a different asset allowance table than SGB II is on the
	// verification checklist in benefitRules.config.ts. Until it is answered, both share one.
	return { benefit, ...assessMeans(answers, today) };
};

/**
 * The rent-burden threshold is a heuristic, not an official figure. The real decision needs
 * the Wohngeld formula (§19 WoGG, Mietstufe 4 for Berlin), which this does not implement.
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
		answers.householdComposition === undefined ||
		answers.children === undefined ||
		answers.monthlyWarmRent === undefined ||
		answers.monthlyNetHouseholdIncome === undefined
	) {
		return { benefit, ...INSUFFICIENT };
	}

	const household: Household = {
		composition: answers.householdComposition,
		children: answers.children,
	};
	const needsWithoutRent = householdStandardNeeds(household, today);
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
			reasons: [ReasonCode.RENT_BURDEN_HIGH],
		};
	}

	return {
		benefit,
		status: BenefitStatus.LIKELY_NO,
		reasons: [ReasonCode.RENT_BURDEN_NORMAL],
	};
};

export const assessChildSupplement = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitAssessment => {
	const benefit = BenefitId.CHILD_SUPPLEMENT;

	if (answers.householdComposition === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	// Three-stage on purpose: a childless composition is a definitive no, while an
	// unanswered children list is only missing data and must not read as a rejection.
	if (!compositionImpliesChildren(answers.householdComposition)) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NO_ELIGIBLE_CHILDREN],
		};
	}
	if (answers.children === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	// At least one child under 25 qualifies, rather than all of them: a household with a
	// 26-year-old and a 5-year-old still has a claim for the younger child.
	if (childrenUnder25(answers.children, today).length === 0) {
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
	if (answers.monthlyGrossIncome === undefined) {
		return { benefit, ...INSUFFICIENT };
	}

	// The minimum applies to what the parents earn together, so a couple needs both figures
	// before the test means anything.
	const couple = isCouple(answers.householdComposition);
	if (couple && answers.partnerMonthlyGrossIncome === undefined) {
		return { benefit, ...INSUFFICIENT };
	}

	const minimum = couple
		? KIZ_MIN_GROSS_INCOME.couple
		: KIZ_MIN_GROSS_INCOME.single;
	const grossIncome =
		answers.monthlyGrossIncome + (answers.partnerMonthlyGrossIncome ?? 0);

	if (grossIncome < minimum) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_NO,
			reasons: [ReasonCode.KIZ_MIN_INCOME_NOT_MET],
		};
	}

	return {
		benefit,
		status: BenefitStatus.CHECK_ADVISED,
		reasons: [ReasonCode.KIZ_MIN_INCOME_MET],
	};
};
