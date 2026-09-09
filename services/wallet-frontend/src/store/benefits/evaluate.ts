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
