import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EligibilityResult } from "./EligibilityResult";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import {
	AssetsBand,
	BenefitId,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../schemas/benefitCheck.schema";
import type { PartialBenefitCheckAnswers } from "../schemas/benefitCheck.schema";

/** Case C from the domain spec: single parent, one child, no maintenance. */
const CASE_C: PartialBenefitCheckAnswers = {
	householdComposition: HouseholdComposition.SINGLE_PARENT,
	children: [{ dateOfBirth: "2020-02-11" }],
	dateOfBirth: "1997-05-02",
	livesInGermany: true,
	workCapacity: WorkCapacity.FULL,
	isEmployed: true,
	monthlyGrossIncome: 1400,
	monthlyNetHouseholdIncome: 1900,
	monthlyWarmRent: 700,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	childReceivesFullSupport: false,
	monthsWithoutChildSupport: 8,
};

/** A comfortable single: nothing matches, so the referral must appear. */
const NO_MATCH: PartialBenefitCheckAnswers = {
	householdComposition: HouseholdComposition.SINGLE,
	children: [],
	dateOfBirth: "1994-01-15",
	livesInGermany: true,
	workCapacity: WorkCapacity.FULL,
	isEmployed: true,
	monthlyGrossIncome: 5000,
	monthlyNetHouseholdIncome: 4000,
	monthlyWarmRent: 700,
	assetsBand: AssetsBand.OVER_25000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
};

const renderResult = () =>
	render(
		<MemoryRouter>
			<EligibilityResult />
		</MemoryRouter>,
	);

const seed = (answers: PartialBenefitCheckAnswers) => {
	const store = useBenefitCheckStore.getState();
	for (const [field, value] of Object.entries(answers)) {
		store.setAnswer(field as never, value as never);
	}
};

describe("EligibilityResult", () => {
	beforeEach(() => {
		useBenefitCheckStore.getState().resetForm();
	});

	// Read the ids with getAttribute, not element.dataset — jsdom does not populate
	// dataset for a hyphenated attribute set through React the way a browser does.
	it("sorts the listed benefits likely, then check, then unlikely", () => {
		seed(CASE_C);
		renderResult();
		const ids = screen
			.getAllByTestId(/^assessment-/)
			.map((card) => card.getAttribute("data-testid"));
		expect(ids).toEqual([
			// LIKELY_YES
			`assessment-${BenefitId.ADVANCE_MAINTENANCE}`,
			// CHECK_ADVISED, in the engine's own order because the sort is stable
			`assessment-${BenefitId.HOUSING_BENEFIT}`,
			`assessment-${BenefitId.CHILD_SUPPLEMENT}`,
			// LIKELY_NO
			`assessment-${BenefitId.SGB_II_BASIC_INCOME}`,
		]);
	});

	it("keeps the benefits that do not concern the applicant out of the main list", () => {
		seed(CASE_C);
		renderResult();
		const ids = screen
			.getAllByTestId(/^assessment-/)
			.map((card) => card.getAttribute("data-testid"));
		expect(ids).not.toContain(
			`assessment-${BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY}`,
		);
		expect(screen.getByTestId("not-applicable-toggle")).toBeInTheDocument();
		expect(screen.queryByTestId("not-applicable-list")).toBeNull();
	});

	it("reveals them on request", () => {
		seed(CASE_C);
		renderResult();
		fireEvent.click(screen.getByTestId("not-applicable-toggle"));
		expect(screen.getByTestId("not-applicable-list")).toBeInTheDocument();
		expect(
			screen.getByTestId(
				`assessment-${BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY}`,
			),
		).toBeInTheDocument();
	});

	it("offers an apply button on the likely benefit only", () => {
		seed(CASE_C);
		renderResult();
		expect(
			screen.getByTestId(`apply-${BenefitId.ADVANCE_MAINTENANCE}`),
		).toBeInTheDocument();
		expect(
			screen.queryByTestId(`apply-${BenefitId.HOUSING_BENEFIT}`),
		).toBeNull();
	});

	it("always renders the disclaimer", () => {
		seed(CASE_C);
		renderResult();
		expect(screen.getByTestId("result-disclaimer")).toBeInTheDocument();
	});

	it("renders the disclaimer even with no answers at all", () => {
		renderResult();
		expect(screen.getByTestId("result-disclaimer")).toBeInTheDocument();
	});

	it("shows the hints the engine produced", () => {
		seed(CASE_C);
		renderResult();
		expect(screen.getByTestId("result-hints")).toBeInTheDocument();
	});

	it("omits the hint list when there are none", () => {
		seed(NO_MATCH);
		renderResult();
		expect(screen.queryByTestId("result-hints")).toBeNull();
	});

	it("offers the referral when nothing matches", () => {
		seed(NO_MATCH);
		renderResult();
		const referral = screen.getByTestId("result-referral");
		expect(referral).toBeInTheDocument();
		expect(referral.querySelector("a")?.getAttribute("href")).toContain(
			"service.berlin.de",
		);
	});

	it("hides the referral as soon as one benefit is live", () => {
		seed(CASE_C);
		renderResult();
		expect(screen.queryByTestId("result-referral")).toBeNull();
	});

	it("links the continue button so the guest sync will fire", () => {
		seed(CASE_C);
		renderResult();
		expect(screen.getByTestId("result-cta")).toHaveAttribute(
			"href",
			"/profile?origin=eligibility",
		);
	});
});
