import {
	BenefitId,
	BenefitStatus,
	Citizenship,
	HintCode,
	ReasonCode,
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

/**
 * The Bildungs- und Teilhabepaket has no test of its own. It rides on one of the five
 * base benefits, so its verdict is read off theirs: as confident as the strongest base
 * verdict, never more. It used to be a hint below the list, which buried it — as a card
 * it sorts in among the benefits it depends on.
 */
const assessEducationPackage = (
	answers: PartialBenefitCheckAnswers,
	assessments: readonly BenefitAssessment[],
): BenefitAssessment => {
	const benefit = BenefitId.EDUCATION_PARTICIPATION_PACKAGE;
	const base = assessments.filter((assessment) =>
		BASE_BENEFITS.includes(assessment.benefit),
	);

	if (answers.children === undefined) {
		return {
			benefit,
			status: BenefitStatus.CHECK_ADVISED,
			reasons: [ReasonCode.INSUFFICIENT_DATA],
		};
	}
	if (answers.children.length === 0) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NO_ELIGIBLE_CHILDREN],
		};
	}
	// Someone who already draws a Grundsicherung has the package by operation of law. The
	// five base assessments all step aside for that answer, so without this branch the
	// package would fall through to LIKELY_NO — the opposite of the truth.
	if (answers.receivesBenefitsAlready === true) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_YES,
			reasons: [ReasonCode.EDUCATION_PACKAGE_FOLLOWS_BASE_BENEFIT],
		};
	}
	if (base.some((a) => a.status === BenefitStatus.LIKELY_YES)) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_YES,
			reasons: [ReasonCode.EDUCATION_PACKAGE_FOLLOWS_BASE_BENEFIT],
		};
	}
	if (base.some((a) => a.status === BenefitStatus.CHECK_ADVISED)) {
		return {
			benefit,
			status: BenefitStatus.CHECK_ADVISED,
			reasons: [ReasonCode.EDUCATION_PACKAGE_FOLLOWS_BASE_BENEFIT],
		};
	}
	return {
		benefit,
		status: BenefitStatus.LIKELY_NO,
		reasons: [ReasonCode.EDUCATION_PACKAGE_NEEDS_BASE_BENEFIT],
	};
};

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
	assessments.push(assessEducationPackage(answers, assessments));

	const hints: HintCode[] = [];

	if (
		answers.citizenship === Citizenship.NON_EU &&
		answers.hasSecureResidenceStatus === false
	) {
		hints.push(HintCode.ASYLUM_BENEFITS_REFERRAL);
	}

	return { assessments, hints };
};
