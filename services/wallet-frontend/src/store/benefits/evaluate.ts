import { Citizenship, HintCode } from "../../schemas/benefitCheck.schema";
import type {
	BenefitAssessment,
	BenefitCheckResult,
	PartialBenefitCheckAnswers,
} from "../../schemas/benefitCheck.schema";
import {
	assessChildSupplement,
	assessHousingBenefit,
	assessSgbIiBasicIncome,
	assessSgbXiiOldAgeReducedCapacity,
} from "./rules";

/**
 * The disclaimer is deliberately NOT part of this result: it is an i18n key the result view
 * renders unconditionally, so it cannot go missing because the engine forgot to attach it.
 */
export const evaluateBenefitCheck = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitCheckResult => {
	const assessments: BenefitAssessment[] = [
		assessSgbIiBasicIncome(answers, today),
		assessSgbXiiOldAgeReducedCapacity(answers, today),
		assessHousingBenefit(answers, today),
		assessChildSupplement(answers, today),
	];

	const hints: HintCode[] = [];

	if (
		answers.citizenship === Citizenship.NON_EU &&
		answers.hasSecureResidenceStatus === false
	) {
		hints.push(HintCode.ASYLUM_BENEFITS_REFERRAL);
	}

	return { assessments, hints };
};
