import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EligibilityFlow } from "./EligibilityFlow";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import {
	HouseholdComposition,
	WorkCapacity,
} from "../schemas/benefitCheck.schema";

const renderAt = (questionId: string) =>
	render(
		<MemoryRouter initialEntries={[`/eligibility-check/${questionId}`]}>
			<Routes>
				<Route
					path="/eligibility-check/:questionId"
					element={<EligibilityFlow />}
				/>
				<Route path="*" element={<div data-testid="elsewhere" />} />
			</Routes>
		</MemoryRouter>,
	);

describe("EligibilityFlow", () => {
	beforeEach(() => {
		useBenefitCheckStore.getState().resetForm();
	});

	it("renders the first question as a choice card", () => {
		renderAt("household");
		expect(screen.getByTestId("question-card")).toBeInTheDocument();
		expect(screen.getByTestId("option-single")).toBeInTheDocument();
	});

	it("stores a choice answer", () => {
		renderAt("household");
		fireEvent.click(screen.getByTestId("option-single"));
		expect(useBenefitCheckStore.getState().answers.householdComposition).toBe(
			HouseholdComposition.SINGLE,
		);
	});

	it("maps the binary options of a boolean question onto true and false", () => {
		const store = useBenefitCheckStore.getState();
		store.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		store.setAnswer("children", []);
		store.setAnswer("dateOfBirth", "1994-01-15");
		renderAt("germany");
		fireEvent.click(screen.getByTestId("option-yes"));
		expect(useBenefitCheckStore.getState().answers.livesInGermany).toBe(true);
	});

	it("renders a number question with its unit", () => {
		const store = useBenefitCheckStore.getState();
		store.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		store.setAnswer("children", []);
		store.setAnswer("dateOfBirth", "1994-01-15");
		store.setAnswer("livesInGermany", true);
		store.setAnswer("workCapacity", WorkCapacity.FULL);
		store.setAnswer("isEmployed", false);
		renderAt("net-income");
		expect(screen.getByTestId("number-input")).toBeInTheDocument();
		// The global i18n mock in vitest.setup.ts returns the key, so this asserts that
		// the unit label is looked up at all — not what it reads in German.
		expect(screen.getByText("questions.net-income.unit")).toBeInTheDocument();
	});

	it("renders the children question as a list", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("householdComposition", HouseholdComposition.SINGLE_PARENT);
		renderAt("children");
		expect(screen.getByTestId("child-date-0")).toBeInTheDocument();
		expect(screen.getByTestId("add-child")).toBeInTheDocument();
	});

	it("redirects a question that the answers skip onto the next open one", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		renderAt("children");
		// The redirect target is another question route, so the flow renders again —
		// at the birthdate, which is where a single person's path actually continues.
		expect(screen.getByTestId("dob-date-input")).toBeInTheDocument();
	});

	it("redirects an unknown question id onto the first question", () => {
		renderAt("nope");
		expect(screen.getByTestId("option-single")).toBeInTheDocument();
	});

	it("takes the progress denominator from the active path", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		renderAt("birthdate");
		const bar = screen.getByRole("progressbar");
		// A single person skips the three child questions: 15 - 3 = 12.
		expect(bar).toHaveAttribute("aria-valuemax", "12");
		expect(bar).toHaveAttribute("aria-valuenow", "2");
	});
});
