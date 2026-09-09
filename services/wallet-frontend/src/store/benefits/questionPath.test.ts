import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type { PartialBenefitCheckAnswers } from "../../schemas/benefitCheck.schema";
import { activeQuestions, getValidPath, questionById } from "./questionPath";

const TODAY = "2026-09-09";

describe("activeQuestions", () => {
	it("offers all fifteen questions while nothing is answered", () => {
		expect(activeQuestions({}, TODAY)).toHaveLength(15);
	});

	it("drops the three child questions for a single person", () => {
		const active = activeQuestions(
			{ householdComposition: HouseholdComposition.SINGLE },
			TODAY,
		).map((q) => q.id);
		expect(active).not.toContain("children");
		expect(active).not.toContain("child-support");
		expect(active).not.toContain("support-duration");
		expect(active).toHaveLength(12);
	});
});

describe("getValidPath", () => {
	it("is just the first question while nothing is answered", () => {
		const path = getValidPath({}, TODAY);
		expect(path.map((q) => q.id)).toEqual(["household"]);
	});

	it("grows by one as each question is answered", () => {
		const path = getValidPath(
			{ householdComposition: HouseholdComposition.SINGLE },
			TODAY,
		);
		expect(path.map((q) => q.id)).toEqual(["household", "birthdate"]);
	});

	it("stops after the first unanswered question", () => {
		const path = getValidPath(
			{
				householdComposition: HouseholdComposition.SINGLE,
				dateOfBirth: "1994-01-15",
			},
			TODAY,
		);
		expect(path.map((q) => q.id)).toEqual([
			"household",
			"birthdate",
			"germany",
		]);
	});

	it("covers the whole path for a complete answer set", () => {
		const complete: PartialBenefitCheckAnswers = {
			householdComposition: HouseholdComposition.SINGLE,
			dateOfBirth: "1994-01-15",
			livesInGermany: true,
			workCapacity: WorkCapacity.FULL,
			isEmployed: true,
			monthlyGrossIncome: 1400,
			monthlyNetHouseholdIncome: 1100,
			monthlyWarmRent: 650,
			assetsBand: AssetsBand.UNDER_5000,
			receivesBenefitsAlready: false,
			citizenship: Citizenship.DE_EU,
		};
		expect(getValidPath(complete, TODAY)).toHaveLength(11);
	});

	it("treats an empty children list as answered", () => {
		const path = getValidPath(
			{
				householdComposition: HouseholdComposition.SINGLE_PARENT,
				children: [],
			},
			TODAY,
		);
		expect(path.map((q) => q.id)).toEqual([
			"household",
			"children",
			"birthdate",
		]);
	});
});

describe("questionById", () => {
	it("finds a question by its route id", () => {
		expect(questionById("warm-rent")?.field).toBe("monthlyWarmRent");
	});

	it("returns undefined for an unknown id", () => {
		expect(questionById("nope")).toBeUndefined();
	});
});
