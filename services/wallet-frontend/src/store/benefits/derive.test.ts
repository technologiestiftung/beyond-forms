import { describe, expect, it } from "vitest";
import { ageInMonths, ageInYears, hasReachedRetirementAge } from "./derive";

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
