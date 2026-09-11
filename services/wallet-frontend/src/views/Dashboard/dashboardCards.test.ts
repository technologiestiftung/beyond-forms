import { describe, expect, it } from "vitest";
import { DASHBOARD_CARDS, partitionDashboardCards } from "./dashboardCards";
import { BenefitId, BenefitStatus } from "../../schemas/benefitCheck.schema";
import type { BenefitAssessment } from "../../schemas/benefitCheck.schema";

const verdicts = (
	entries: { benefit: string; status: string }[],
): BenefitAssessment[] =>
	entries.map((entry) => ({
		benefit: entry.benefit as BenefitAssessment["benefit"],
		status: entry.status as BenefitStatus,
		reasons: [],
	}));

const ids = (cards: { id: string }[]) => cards.map((card) => card.id);

describe("partitionDashboardCards", () => {
	it("shows every card when there is no assessment at all", () => {
		const { visible, hidden } = partitionDashboardCards(undefined);
		expect(visible).toHaveLength(DASHBOARD_CARDS.length);
		expect(hidden).toEqual([]);
	});

	it("folds away only the benefits the check ruled out", () => {
		const { visible, hidden } = partitionDashboardCards(
			verdicts([
				{ benefit: BenefitId.HOUSING_BENEFIT, status: "LIKELY_YES" },
				{ benefit: BenefitId.CHILD_SUPPLEMENT, status: "CHECK_ADVISED" },
				{ benefit: BenefitId.SGB_II_BASIC_INCOME, status: "LIKELY_NO" },
				{
					benefit: BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY,
					status: "NOT_APPLICABLE",
				},
			]),
		);
		expect(ids(visible)).toEqual([
			"parking_permit",
			"housing_allowance",
			"child_allowance",
		]);
		expect(ids(hidden)).toEqual(["basic_security", "basic_income"]);
	});

	it("never folds away a card that has no benefit behind it", () => {
		const { visible, hidden } = partitionDashboardCards(
			verdicts(
				DASHBOARD_CARDS.filter((card) => card.benefit).map((card) => ({
					benefit: card.benefit as string,
					status: "LIKELY_NO" as const,
				})),
			),
		);
		expect(ids(visible)).toEqual(["parking_permit"]);
		expect(hidden).toHaveLength(DASHBOARD_CARDS.length - 1);
	});

	it("shows a benefit the assessment says nothing about", () => {
		const { visible } = partitionDashboardCards(
			verdicts([
				{ benefit: BenefitId.SGB_II_BASIC_INCOME, status: "LIKELY_NO" },
			]),
		);
		expect(ids(visible)).toContain("housing_allowance");
		expect(ids(visible)).toContain("basic_security");
	});

	it("keeps the configured order within each group", () => {
		const { visible } = partitionDashboardCards(
			verdicts([
				{ benefit: BenefitId.SGB_II_BASIC_INCOME, status: "LIKELY_YES" },
			]),
		);
		expect(ids(visible)).toEqual(ids([...DASHBOARD_CARDS]));
	});
});
