import { describe, it, expect } from "vitest";
import { EligibilityEngine } from "./EligibilityEngine";
import {
	AssetsBand,
	Binary,
	Citizenship,
	HouseholdComposition,
	ResultProfile,
	WorkCapacity,
} from "../schemas/eligibility.schema";
import type { EligibilityCheck } from "../schemas/eligibility.schema";

const workingSingle: Partial<EligibilityCheck> = {
	householdComposition: HouseholdComposition.SINGLE,
	dateOfBirth: "1990-05-01",
	livesInGermany: Binary.YES,
	isEmployed: Binary.YES,
	monthlyGrossIncome: 1500,
	workCapacity: WorkCapacity.FULL,
	monthlyNetHouseholdIncome: 1100,
	monthlyWarmRent: 600,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefits: Binary.NO,
	citizenship: Citizenship.GERMAN,
};

describe("EligibilityEngine", () => {
	describe("getValidPath", () => {
		it("starts with the household question", () => {
			expect(EligibilityEngine.getValidPath({})).toEqual(["household"]);
		});

		it("walks every question for a working single with EU citizenship", () => {
			const path = EligibilityEngine.getValidPath(workingSingle);
			expect(path).toEqual([
				"household",
				"birthdate",
				"germany",
				"employment",
				"gross-income",
				"work-capacity",
				"net-income",
				"warm-rent",
				"assets",
				"benefits",
				"citizenship",
				"result_eligible",
			]);
			expect(EligibilityEngine.getOutcomeProfile(path)).toBe(
				ResultProfile.ELIGIBLE,
			);
		});

		it("asks for children only when the household has children", () => {
			const path = EligibilityEngine.getValidPath({
				householdComposition: HouseholdComposition.SINGLE_PARENT,
				children: [{ dateOfBirth: "2018-03-01" }],
			});
			expect(path).toEqual(["household", "children", "birthdate"]);
		});

		it("ends the check when the person does not live in Germany", () => {
			const path = EligibilityEngine.getValidPath({
				...workingSingle,
				livesInGermany: Binary.NO,
			});
			expect(path).toEqual([
				"household",
				"birthdate",
				"germany",
				"result_not_eligible",
			]);
			expect(EligibilityEngine.getOutcomeProfile(path)).toBe(
				ResultProfile.NOT_ELIGIBLE,
			);
		});

		it("skips gross income when not working, and work capacity past retirement age", () => {
			const path = EligibilityEngine.getValidPath({
				...workingSingle,
				dateOfBirth: "1950-01-01",
				isEmployed: Binary.NO,
			});
			expect(path).not.toContain("gross-income");
			expect(path).not.toContain("work-capacity");
			expect(path).toContain("net-income");
		});

		it("asks for the residence status only outside the EU", () => {
			const path = EligibilityEngine.getValidPath({
				...workingSingle,
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: Binary.YES,
			});
			expect(path.slice(-3)).toEqual([
				"citizenship",
				"residence-status",
				"result_eligible",
			]);
		});

		it("accepts 0 as an answer", () => {
			const path = EligibilityEngine.getValidPath({
				...workingSingle,
				monthlyNetHouseholdIncome: 0,
			});
			expect(path).toContain("warm-rent");
		});
	});

	describe("answersOnValidPath", () => {
		it("drops a gross income left over from before switching to not working", () => {
			const answers = EligibilityEngine.answersOnValidPath({
				...workingSingle,
				isEmployed: Binary.NO,
			});
			expect(answers.monthlyGrossIncome).toBeUndefined();
			expect(answers.monthlyNetHouseholdIncome).toBe(1100);
		});

		it("drops answers after the first unanswered question", () => {
			const { workCapacity: _skipped, ...answers } = workingSingle;
			const onPath = EligibilityEngine.answersOnValidPath(answers);
			expect(onPath.monthlyGrossIncome).toBe(1500);
			expect(onPath.citizenship).toBeUndefined();
		});
	});

	describe("getProgress", () => {
		it("starts at 0 and reaches 1 on the result", () => {
			expect(EligibilityEngine.getProgress({}, "household")).toBe(0);
			expect(
				EligibilityEngine.getProgress(workingSingle, "result_eligible"),
			).toBe(1);
		});

		it("only ever moves forward along the path", () => {
			const answers = { ...workingSingle, citizenship: Citizenship.NON_EU };
			const path = EligibilityEngine.getValidPath(answers);
			const values = path.map((id) =>
				EligibilityEngine.getProgress(answers, id),
			);
			values.slice(1).forEach((value, i) => {
				expect(value).toBeGreaterThan(values[i]);
			});
		});

		it("counts an added conditional question as progress", () => {
			const single = EligibilityEngine.getProgress(
				{ householdComposition: HouseholdComposition.SINGLE },
				"birthdate",
			);
			const withChildren = EligibilityEngine.getProgress(
				{
					householdComposition: HouseholdComposition.SINGLE_PARENT,
					children: [{ dateOfBirth: "2018-03-01" }],
				},
				"birthdate",
			);
			expect(withChildren).toBeGreaterThan(single);
		});
	});
});
