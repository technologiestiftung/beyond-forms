import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitCheckAnswersSchema,
	HouseholdComposition,
	WorkCapacity,
} from "./benefitCheck.schema";

describe("BenefitCheckAnswersSchema", () => {
	it("accepts a list of children", () => {
		const result = BenefitCheckAnswersSchema.shape.children.safeParse([
			{ dateOfBirth: "2019-04-02" },
		]);
		expect(result.success).toBe(true);
	});

	it("accepts an empty children array", () => {
		const result = BenefitCheckAnswersSchema.shape.children.safeParse([]);
		expect(result.success).toBe(true);
	});

	it("rejects a child born in the future", () => {
		const result = BenefitCheckAnswersSchema.shape.children.safeParse([
			{ dateOfBirth: "2999-01-01" },
		]);
		expect(result.success).toBe(false);
	});

	it("accepts a household composition on its own", () => {
		const result =
			BenefitCheckAnswersSchema.shape.householdComposition.safeParse(
				HouseholdComposition.SINGLE_PARENT,
			);
		expect(result.success).toBe(true);
	});

	it("rejects a calendar-invalid date of birth", () => {
		const result =
			BenefitCheckAnswersSchema.shape.dateOfBirth.safeParse("1990-02-30");
		expect(result.success).toBe(false);
	});

	it("rejects a date of birth before 1900", () => {
		const result =
			BenefitCheckAnswersSchema.shape.dateOfBirth.safeParse("1899-12-31");
		expect(result.success).toBe(false);
	});

	it("rejects a negative gross income", () => {
		const result =
			BenefitCheckAnswersSchema.shape.monthlyGrossIncome.safeParse(-1);
		expect(result.success).toBe(false);
	});

	it("exposes per-field schemas so the store can validate one answer at a time", () => {
		expect(
			BenefitCheckAnswersSchema.shape.workCapacity.safeParse(WorkCapacity.FULL)
				.success,
		).toBe(true);
		expect(
			BenefitCheckAnswersSchema.shape.assetsBand.safeParse(
				AssetsBand.FROM_5000_TO_15000,
			).success,
		).toBe(true);
		expect(
			BenefitCheckAnswersSchema.shape.assetsBand.safeParse("NOPE").success,
		).toBe(false);
	});
});
