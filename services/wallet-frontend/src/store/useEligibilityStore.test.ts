import { describe, it, expect, beforeEach } from "vitest";
import { useEligibilityStore } from "./useEligibilityStore";
import { Binary, HouseholdComposition } from "../schemas/eligibility.schema";

describe("useEligibilityStore", () => {
	beforeEach(() => {
		useEligibilityStore.getState().resetForm();
		sessionStorage.clear();
	});

	it("keeps answers that fall off the path", () => {
		const { setAnswer } = useEligibilityStore.getState();

		setAnswer("householdComposition", HouseholdComposition.SINGLE_PARENT);
		setAnswer("children", [{ dateOfBirth: "2018-03-01" }]);
		setAnswer("householdComposition", HouseholdComposition.SINGLE);

		expect(useEligibilityStore.getState().answers.children).toEqual([
			{ dateOfBirth: "2018-03-01" },
		]);
	});

	it("marks the check as not eligible when living outside Germany", () => {
		const { setAnswer } = useEligibilityStore.getState();

		setAnswer("householdComposition", HouseholdComposition.SINGLE);
		setAnswer("dateOfBirth", "1955-01-01");
		setAnswer("livesInGermany", Binary.NO);

		expect(useEligibilityStore.getState().isEligible).toBe(false);
	});

	it("should clear an answer and remove it from state", () => {
		const { setAnswer, clearAnswer } = useEligibilityStore.getState();

		setAnswer("dateOfBirth", "1955-01-01");
		expect(useEligibilityStore.getState().answers.dateOfBirth).toBe(
			"1955-01-01",
		);

		clearAnswer("dateOfBirth");
		expect(useEligibilityStore.getState().answers.dateOfBirth).toBeUndefined();
	});

	it("should handle validation errors", () => {
		const { setAnswer } = useEligibilityStore.getState();
		// @ts-expect-error - Intentionally testing runtime validation failure
		setAnswer("householdComposition", "INVALID_ENUM");

		expect(useEligibilityStore.getState().validationError).toBeDefined();
		expect(
			useEligibilityStore.getState().answers.householdComposition,
		).toBeUndefined();
	});

	it("rejects negative amounts", () => {
		const { setAnswer } = useEligibilityStore.getState();

		setAnswer("monthlyWarmRent", -1);

		expect(useEligibilityStore.getState().validationError).toBeDefined();
		expect(
			useEligibilityStore.getState().answers.monthlyWarmRent,
		).toBeUndefined();
	});

	it("rejects an empty children list", () => {
		const { setAnswer } = useEligibilityStore.getState();

		setAnswer("children", []);

		expect(useEligibilityStore.getState().answers.children).toBeUndefined();
	});

	it("should set validationError for out-of-range date of birth", () => {
		const { setAnswer } = useEligibilityStore.getState();

		setAnswer("dateOfBirth", "1899-12-31");

		expect(useEligibilityStore.getState().validationError).toBe(
			"Date must be on or after 1 January 1900",
		);
		expect(useEligibilityStore.getState().answers.dateOfBirth).toBeUndefined();
	});

	it("should set validationError for malformed date of birth", () => {
		const { setAnswer } = useEligibilityStore.getState();

		setAnswer("dateOfBirth", "12.07.2000");

		expect(useEligibilityStore.getState().validationError).toBe(
			"Invalid date format",
		);
		expect(useEligibilityStore.getState().answers.dateOfBirth).toBeUndefined();
	});
});
