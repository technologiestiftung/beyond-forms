import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitCheckAnswersSchema,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import { QUESTION_CATALOGUE } from "./questionCatalogue";

const TODAY = "2026-09-09";

describe("QUESTION_CATALOGUE", () => {
	it("has exactly one question per answer field and no orphans", () => {
		const fields = Object.keys(BenefitCheckAnswersSchema.shape).sort();
		const asked = QUESTION_CATALOGUE.map((q) => q.field as string).sort();
		expect(asked).toEqual(fields);
	});

	it("has unique route ids", () => {
		const ids = QUESTION_CATALOGUE.map((q) => q.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("offers options for every choice question and none for the others", () => {
		for (const question of QUESTION_CATALOGUE) {
			if (question.input === "choice") {
				expect(question.options, question.id).toBeDefined();
				expect(question.options?.length, question.id).toBeGreaterThan(1);
			} else {
				expect(question.options, question.id).toBeUndefined();
			}
		}
	});

	it("gives every number question a unit", () => {
		for (const question of QUESTION_CATALOGUE) {
			if (question.input === "number") {
				expect(question.unit, question.id).toBeDefined();
			}
		}
	});

	it("never skips on an empty answer set", () => {
		for (const question of QUESTION_CATALOGUE) {
			expect(question.skipIf?.({}, TODAY) ?? false, question.id).toBe(false);
		}
	});

	it("skips the children questions for a childless household", () => {
		const childless = { householdComposition: HouseholdComposition.SINGLE };
		const skipped = QUESTION_CATALOGUE.filter((q) =>
			q.skipIf?.(childless, TODAY),
		).map((q) => q.id);
		expect(skipped).toContain("children");
		expect(skipped).toContain("child-support");
	});

	it("skips work capacity once the retirement age is reached", () => {
		const retired = { dateOfBirth: "1950-01-01" };
		const skipped = QUESTION_CATALOGUE.filter((q) =>
			q.skipIf?.(retired, TODAY),
		).map((q) => q.id);
		expect(skipped).toContain("work-capacity");
	});

	it("skips the gross income question when not employed", () => {
		const skipped = QUESTION_CATALOGUE.filter((q) =>
			q.skipIf?.({ isEmployed: false }, TODAY),
		).map((q) => q.id);
		expect(skipped).toContain("gross-income");
	});

	it("skips the residence status question for EU citizens", () => {
		const skipped = QUESTION_CATALOGUE.filter((q) =>
			q.skipIf?.({ citizenship: Citizenship.DE_EU }, TODAY),
		).map((q) => q.id);
		expect(skipped).toContain("residence-status");
	});

	it("skips the support duration unless support is actually missing", () => {
		const duration = QUESTION_CATALOGUE.find(
			(q) => q.id === "support-duration",
		);
		expect(duration?.skipIf?.({ childReceivesFullSupport: true }, TODAY)).toBe(
			true,
		);
		expect(duration?.skipIf?.({ childReceivesFullSupport: false }, TODAY)).toBe(
			false,
		);
	});

	it("declares options that the schema accepts", () => {
		const byField = {
			householdComposition: Object.values(HouseholdComposition),
			workCapacity: Object.values(WorkCapacity),
			assetsBand: Object.values(AssetsBand),
			citizenship: Object.values(Citizenship),
		} as Record<string, string[]>;

		for (const question of QUESTION_CATALOGUE) {
			const allowed = byField[question.field as string];
			if (question.input === "choice" && allowed) {
				expect([...(question.options ?? [])].sort(), question.id).toEqual(
					[...allowed].sort(),
				);
			}
		}
	});
});
