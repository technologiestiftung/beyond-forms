import { describe, it, expect } from "vitest";
import { EligibilityEngine } from "./EligibilityEngine";
import {
	Binary,
	NationalityStatus,
	PensionStatus,
	IncomeStatus,
	ResultProfile,
} from "../schemas/eligibility.schema";

describe("EligibilityEngine (Headless Logic Core)", () => {
	describe("Path Navigation", () => {
		it("should start with the nationality question", () => {
			const path = EligibilityEngine.getValidPath({});
			expect(path).toEqual(["nationality"]);
		});

		it("should correctly branch for Sozialamt referral (no qualifying nationality)", () => {
			const answers = { nationality: NationalityStatus.NONE };
			const path = EligibilityEngine.getValidPath(answers);
			expect(path).toEqual(["nationality", "result_sozialamt"]);
			expect(EligibilityEngine.getOutcomeProfile(path)).toBe(
				ResultProfile.SOZIALAMT,
			);
		});

		it("should correctly branch for eligible senior persona", () => {
			const answers = {
				nationality: NationalityStatus.GERMAN,
				livesInGermany: Binary.YES,
				dateOfBirth: "1955-01-01",
				pension: PensionStatus.OLD_AGE,
				income: IncomeStatus.NOT_SUFFICIENT,
				hasAssetsAboveThreshold: Binary.NO,
			};
			const path = EligibilityEngine.getValidPath(answers);
			expect(path).toEqual([
				"nationality",
				"germany",
				"birthdate",
				"pension",
				"income",
				"assets",
				"result_eligible",
			]);
			expect(EligibilityEngine.getOutcomeProfile(path)).toBe(
				ResultProfile.ELIGIBLE,
			);
		});

		it("should branch to other benefit when not living in Germany", () => {
			const answers = {
				nationality: NationalityStatus.GERMAN,
				livesInGermany: Binary.NO,
			};
			const path = EligibilityEngine.getValidPath(answers);
			expect(path).toEqual(["nationality", "germany", "result_not_eligible"]);
			expect(EligibilityEngine.getOutcomeProfile(path)).toBe(
				ResultProfile.NOT_ELIGIBLE,
			);
		});

		it("should branch to other benefit when no pension", () => {
			const answers = {
				nationality: NationalityStatus.GERMAN,
				livesInGermany: Binary.YES,
				dateOfBirth: "1955-01-01",
				pension: PensionStatus.NONE,
			};
			const path = EligibilityEngine.getValidPath(answers);
			expect(path).toEqual([
				"nationality",
				"germany",
				"birthdate",
				"pension",
				"result_not_eligible",
			]);
			expect(EligibilityEngine.getOutcomeProfile(path)).toBe(
				ResultProfile.NOT_ELIGIBLE,
			);
		});

		it("should branch to other benefit when income is sufficient", () => {
			const answers = {
				nationality: NationalityStatus.GERMAN,
				livesInGermany: Binary.YES,
				dateOfBirth: "1955-01-01",
				pension: PensionStatus.OLD_AGE,
				income: IncomeStatus.SUFFICIENT,
			};
			const path = EligibilityEngine.getValidPath(answers);
			expect(path).toEqual([
				"nationality",
				"germany",
				"birthdate",
				"pension",
				"income",
				"result_not_eligible",
			]);
			expect(EligibilityEngine.getOutcomeProfile(path)).toBe(
				ResultProfile.NOT_ELIGIBLE,
			);
		});

		it("should branch to not eligible when assets exceed threshold", () => {
			const answers = {
				nationality: NationalityStatus.GERMAN,
				livesInGermany: Binary.YES,
				dateOfBirth: "1955-01-01",
				pension: PensionStatus.REDUCED_EARNING_CAPACITY,
				income: IncomeStatus.SOON_INSUFFICIENT,
				hasAssetsAboveThreshold: Binary.YES,
			};
			const path = EligibilityEngine.getValidPath(answers);
			expect(path).toEqual([
				"nationality",
				"germany",
				"birthdate",
				"pension",
				"income",
				"assets",
				"result_not_eligible",
			]);
			expect(EligibilityEngine.getOutcomeProfile(path)).toBe(
				ResultProfile.NOT_ELIGIBLE,
			);
		});

		it("should be robust against stale extra data (Non-Destructive)", () => {
			const answers = {
				nationality: NationalityStatus.NONE,
				livesInGermany: Binary.YES,
				pension: PensionStatus.OLD_AGE,
			};
			const path = EligibilityEngine.getValidPath(answers);
			expect(path).toEqual(["nationality", "result_sozialamt"]);
		});
	});

	describe("Node Metadata", () => {
		it("should return correct metadata for nodes", () => {
			const node = EligibilityEngine.getNode("nationality");
			expect(node.type).toBe("multi-choice");
			expect(node.key).toBe("nationality");
		});
	});
});
