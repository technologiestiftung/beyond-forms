import { BenefitId, BenefitStatus } from "../../schemas/benefitCheck.schema";
import type { BenefitAssessment } from "../../schemas/benefitCheck.schema";

/**
 * A card's i18n key under `sections.applications.*` and, where one exists, the benefit the
 * Anspruchsradar assesses for it.
 *
 * `benefit: null` means the card is never gated. The Bewohnerparkausweis is not a
 * means-tested benefit and the check says nothing about it, so it must always be offered.
 */
export interface DashboardCardSpec {
	id: string;
	/** "guided" renders ApplicationCard, which owns its own form type and copy. */
	kind: "guided" | "simple";
	formType?: string;
	benefit: BenefitId | null;
}

export const DASHBOARD_CARDS: readonly DashboardCardSpec[] = [
	{
		id: "basic_security",
		kind: "guided",
		benefit: BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY,
	},
	{
		id: "parking_permit",
		kind: "simple",
		formType: "antrag_bewohnerparkausweis",
		benefit: null,
	},
	{
		id: "housing_allowance",
		kind: "simple",
		formType: "antrag_wohngeld",
		benefit: BenefitId.HOUSING_BENEFIT,
	},
	{
		id: "basic_income",
		kind: "simple",
		formType: "antrag_grundsicherungsgeld",
		benefit: BenefitId.SGB_II_BASIC_INCOME,
	},
	{
		id: "child_allowance",
		kind: "simple",
		formType: "antrag_kinderzuschlag",
		benefit: BenefitId.CHILD_SUPPLEMENT,
	},
];

/**
 * Splits the cards into the ones to offer and the ones to fold away.
 *
 * Only the two negative verdicts fold a card away. Everything else stays visible, including
 * a benefit the assessment could not decide — which is the usual case, because the profile
 * does not carry the gross income, savings band or warm rent the means tests need, so those
 * come back CHECK_ADVISED. Hiding a form from someone who turns out to be entitled to it is
 * the worse failure, so anything undecided resolves to visible.
 */
export const partitionDashboardCards = (
	assessments: readonly BenefitAssessment[] | undefined,
): { visible: DashboardCardSpec[]; hidden: DashboardCardSpec[] } => {
	if (!assessments) {
		return { visible: [...DASHBOARD_CARDS], hidden: [] };
	}

	const statusByBenefit = new Map(
		assessments.map((assessment) => [assessment.benefit, assessment.status]),
	);
	const visible: DashboardCardSpec[] = [];
	const hidden: DashboardCardSpec[] = [];

	for (const card of DASHBOARD_CARDS) {
		const status = card.benefit ? statusByBenefit.get(card.benefit) : undefined;
		if (
			status === BenefitStatus.LIKELY_NO ||
			status === BenefitStatus.NOT_APPLICABLE
		) {
			hidden.push(card);
		} else {
			visible.push(card);
		}
	}

	return { visible, hidden };
};
