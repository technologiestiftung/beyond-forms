import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitCheckAnswersSchema,
	HouseholdComposition,
	WorkCapacity,
} from "./benefitCheck.schema";

describe("BenefitCheckAnswersSchema", () => {
	it("accepts a complete household with children", () => {
		const result = BenefitCheckAnswersSchema.shape.household.safeParse({
			composition: HouseholdComposition.SINGLE_PARENT,
			children: [{ dateOfBirth: "2019-04-02" }],
		});
		expect(result.success).toBe(true);
	});

	it("accepts an empty children array", () => {
		const result = BenefitCheckAnswersSchema.shape.household.safeParse({
			composition: HouseholdComposition.SINGLE,
			children: [],
		});
		expect(result.success).toBe(true);
	});

	it("rejects a child born in the future", () => {
		const result = BenefitCheckAnswersSchema.shape.household.safeParse({
			composition: HouseholdComposition.SINGLE_PARENT,
			children: [{ dateOfBirth: "2999-01-01" }],
		});
		expect(result.success).toBe(false);
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
		const result = BenefitCheckAnswersSchema.shape.employment.safeParse({
			isEmployed: true,
			monthlyGrossIncome: -1,
		});
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
