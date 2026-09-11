import { beforeEach, describe, expect, it } from "vitest";
import {
	AssetsBand,
	HouseholdComposition,
} from "../schemas/benefitCheck.schema";
import { useBenefitCheckStore } from "./useBenefitCheckStore";

describe("useBenefitCheckStore", () => {
	beforeEach(() => {
		useBenefitCheckStore.getState().resetForm();
	});

	it("stores a valid answer", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		expect(useBenefitCheckStore.getState().answers.householdComposition).toBe(
			HouseholdComposition.SINGLE,
		);
		expect(useBenefitCheckStore.getState().validationError).toBeNull();
	});

	it("rejects an invalid answer and records the error instead of throwing", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("assetsBand", "NOPE" as AssetsBand);
		expect(useBenefitCheckStore.getState().answers.assetsBand).toBeUndefined();
		expect(useBenefitCheckStore.getState().validationError).toBeTruthy();
	});

	it("rejects a negative number", () => {
		useBenefitCheckStore.getState().setAnswer("monthlyWarmRent", -5);
		expect(
			useBenefitCheckStore.getState().answers.monthlyWarmRent,
		).toBeUndefined();
		expect(useBenefitCheckStore.getState().validationError).toBeTruthy();
	});

	it("clears the error on the next valid answer", () => {
		useBenefitCheckStore.getState().setAnswer("monthlyWarmRent", -5);
		useBenefitCheckStore.getState().setAnswer("monthlyWarmRent", 650);
		expect(useBenefitCheckStore.getState().answers.monthlyWarmRent).toBe(650);
		expect(useBenefitCheckStore.getState().validationError).toBeNull();
	});

	it("accepts an empty children list", () => {
		useBenefitCheckStore.getState().setAnswer("children", []);
		expect(useBenefitCheckStore.getState().answers.children).toEqual([]);
	});

	it("removes exactly one field on clearAnswer", () => {
		const store = useBenefitCheckStore.getState();
		store.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		store.setAnswer("monthlyWarmRent", 650);
		useBenefitCheckStore.getState().clearAnswer("monthlyWarmRent");
		expect(
			useBenefitCheckStore.getState().answers.monthlyWarmRent,
		).toBeUndefined();
		expect(useBenefitCheckStore.getState().answers.householdComposition).toBe(
			HouseholdComposition.SINGLE,
		);
	});

	it("never lets maxDepthReached exceed the current path length", () => {
		useBenefitCheckStore.getState().recordStepReached(9);
		// Nothing is answered, so the path is one question long.
		expect(useBenefitCheckStore.getState().maxDepthReached).toBe(1);
	});

	it("remembers the deepest step reached", () => {
		const store = useBenefitCheckStore.getState();
		store.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		store.setAnswer("dateOfBirth", "1994-01-15");
		useBenefitCheckStore.getState().recordStepReached(3);
		expect(useBenefitCheckStore.getState().maxDepthReached).toBe(3);
		useBenefitCheckStore.getState().recordStepReached(2);
		expect(useBenefitCheckStore.getState().maxDepthReached).toBe(3);
	});

	it("resets everything", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		useBenefitCheckStore.getState().resetForm();
		expect(useBenefitCheckStore.getState().answers).toEqual({});
		expect(useBenefitCheckStore.getState().maxDepthReached).toBe(0);
		expect(useBenefitCheckStore.getState().validationError).toBeNull();
	});
});
