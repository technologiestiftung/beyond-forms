import { describe, expect, it } from "vitest";
import { AssetsBand } from "../../schemas/benefitCheck.schema";
import {
	ageInMonths,
	ageInYears,
	assetAllowance,
	assetsVsAllowance,
	hasReachedRetirementAge,
} from "./derive";

describe("ageInYears", () => {
	it("counts a birthday that has already passed this year", () => {
		expect(ageInYears("1990-03-15", "2026-09-09")).toBe(36);
	});

	it("does not count a birthday still ahead this year", () => {
		expect(ageInYears("1990-12-15", "2026-09-09")).toBe(35);
	});

	it("counts the birthday itself", () => {
		expect(ageInYears("1990-09-09", "2026-09-09")).toBe(36);
	});

	it("does not count the day before the birthday", () => {
		expect(ageInYears("1990-09-10", "2026-09-09")).toBe(35);
	});
});

describe("ageInMonths", () => {
	it("counts whole months only", () => {
		expect(ageInMonths("2026-01-15", "2026-09-09")).toBe(7);
		expect(ageInMonths("2026-01-09", "2026-09-09")).toBe(8);
	});
});

describe("hasReachedRetirementAge", () => {
	it("is false for someone clearly of working age", () => {
		expect(hasReachedRetirementAge("1990-01-01", "2026-09-09")).toBe(false);
	});

	it("uses 67 years for the 1964 cohort and later", () => {
		expect(hasReachedRetirementAge("1964-09-09", "2031-09-08")).toBe(false);
		expect(hasReachedRetirementAge("1964-09-09", "2031-09-09")).toBe(true);
	});

	it("uses 65 years for cohorts up to 1946", () => {
		expect(hasReachedRetirementAge("1946-06-01", "2011-05-31")).toBe(false);
		expect(hasReachedRetirementAge("1946-06-01", "2011-06-01")).toBe(true);
	});

	it("applies the staggered months for the 1959 cohort (66 years, 2 months)", () => {
		expect(hasReachedRetirementAge("1959-01-15", "2025-03-14")).toBe(false);
		expect(hasReachedRetirementAge("1959-01-15", "2025-03-15")).toBe(true);
	});
});

describe("assetAllowance", () => {
	it("staggers by age", () => {
		expect(assetAllowance(29)).toBe(5000);
		expect(assetAllowance(30)).toBe(10000);
		expect(assetAllowance(39)).toBe(10000);
		expect(assetAllowance(40)).toBe(12500);
		expect(assetAllowance(49)).toBe(12500);
		expect(assetAllowance(50)).toBe(20000);
		expect(assetAllowance(84)).toBe(20000);
	});
});

describe("assetsVsAllowance", () => {
	it("reports BELOW when the whole band is under the allowance", () => {
		expect(assetsVsAllowance(AssetsBand.UNDER_5000, 10000)).toBe("BELOW");
	});

	it("reports ABOVE when the whole band is at or over the allowance", () => {
		expect(assetsVsAllowance(AssetsBand.FROM_15000_TO_25000, 12500)).toBe(
			"ABOVE",
		);
		expect(assetsVsAllowance(AssetsBand.OVER_25000, 20000)).toBe("ABOVE");
	});

	it("reports SPANS when the band straddles the allowance", () => {
		// The domain spec's test case E: age 38 -> allowance 10000, assets 5000-15000.
		expect(assetsVsAllowance(AssetsBand.FROM_5000_TO_15000, 10000)).toBe(
			"SPANS",
		);
	});

	it("treats an allowance exactly on the upper bound as BELOW", () => {
		expect(assetsVsAllowance(AssetsBand.UNDER_5000, 5000)).toBe("BELOW");
	});

	it("treats an allowance exactly on the lower bound as ABOVE", () => {
		expect(assetsVsAllowance(AssetsBand.FROM_5000_TO_15000, 5000)).toBe(
			"ABOVE",
		);
	});
});
