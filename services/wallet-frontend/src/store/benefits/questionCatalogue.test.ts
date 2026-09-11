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
	});

	it("skips work capacity once the retirement age is reached", () => {
		const retired = { dateOfBirth: "1950-01-01" };
		const skipped = QUESTION_CATALOGUE.filter((q) =>
			q.skipIf?.(retired, TODAY),
		).map((q) => q.id);
		expect(skipped).toContain("work-capacity");
	});

	it("asks for the gross income even when there is no job", () => {
		const skipped = QUESTION_CATALOGUE.filter((q) =>
			q.skipIf?.({ isEmployed: false }, TODAY),
		).map((q) => q.id);
		expect(skipped).not.toContain("gross-income");
	});

	it("skips the residence status question for EU citizens", () => {
		const skipped = QUESTION_CATALOGUE.filter((q) =>
			q.skipIf?.({ citizenship: Citizenship.DE_EU }, TODAY),
		).map((q) => q.id);
		expect(skipped).toContain("residence-status");
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

describe("work capacity skip by income", () => {
	const workCapacity = QUESTION_CATALOGUE.find((q) => q.id === "work-capacity");

	it("is skipped for someone earning comfortably above the threshold", () => {
		expect(
			workCapacity?.skipIf?.(
				{ isEmployed: true, monthlyGrossIncome: 2400 },
				TODAY,
			),
		).toBe(true);
	});

	/**
	 * The reason the threshold exists. A Werkstatt für behinderte Menschen pays on the
	 * order of 220 EUR a month, and those workers are typically fully unable to work on
	 * the general labour market — exactly what SGB XII Kap. 4 is for. They must keep
	 * being asked.
	 */
	it("still asks someone on Werkstatt pay", () => {
		expect(
			workCapacity?.skipIf?.(
				{ isEmployed: true, monthlyGrossIncome: 220 },
				TODAY,
			),
		).toBe(false);
	});

	it("still asks at the threshold itself", () => {
		expect(
			workCapacity?.skipIf?.(
				{ isEmployed: true, monthlyGrossIncome: 1000 },
				TODAY,
			),
		).toBe(false);
	});

	it("skips on the applicant's own income whether or not they call it a job", () => {
		expect(
			workCapacity?.skipIf?.(
				{ isEmployed: false, monthlyGrossIncome: 2400 },
				TODAY,
			),
		).toBe(true);
	});

	it("still skips past the retirement age regardless of income", () => {
		expect(
			workCapacity?.skipIf?.(
				{ dateOfBirth: "1950-01-01", isEmployed: false },
				TODAY,
			),
		).toBe(true);
	});
});

/**
 * A skip condition may only read answers collected before it. Reading a later field would
 * make the skip depend on a question the visitor has not reached yet, which silently
 * shortens the path and the progress denominator.
 */
describe("skip conditions read only earlier answers", () => {
	const SAMPLE: Record<string, unknown> = {
		householdComposition: HouseholdComposition.SINGLE_PARENT,
		children: [{ dateOfBirth: "2015-03-01" }],
		dateOfBirth: "1994-01-15",
		livesInGermany: true,
		isEmployed: true,
		monthlyGrossIncome: 1400,
		workCapacity: WorkCapacity.FULL,
		monthlyNetHouseholdIncome: 1100,
		monthlyWarmRent: 650,
		assetsBand: AssetsBand.UNDER_5000,
		receivesBenefitsAlready: false,
		citizenship: Citizenship.NON_EU,
		hasSecureResidenceStatus: true,
	};

	it.each(QUESTION_CATALOGUE.map((question, index) => [question.id, index]))(
		"%s",
		(_id, index) => {
			const question = QUESTION_CATALOGUE[index as number];
			if (!question.skipIf) {
				return;
			}
			const earlier = new Set(
				QUESTION_CATALOGUE.slice(0, index as number).map(
					(q) => q.field as string,
				),
			);
			const read: string[] = [];
			const spy = new Proxy(
				{ ...SAMPLE },
				{
					get(target, property: string) {
						read.push(property);
						return target[property];
					},
				},
			);

			question.skipIf(spy, TODAY);

			expect(read.filter((field) => !earlier.has(field))).toEqual([]);
		},
	);
});
