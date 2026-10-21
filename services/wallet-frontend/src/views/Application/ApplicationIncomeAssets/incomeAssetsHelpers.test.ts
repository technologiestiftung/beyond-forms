import { describe, it, expect } from "vitest";
import {
	calculateTotalIncome,
	countIncomeCategories,
	withPensionSources,
} from "./incomeAssetsHelpers";

const noIncome = {
	pensionTypes: [],
	pensionAmount: "",
	employmentType: "",
	employmentAmount: "",
	otherIncomeTypes: [],
	otherIncomeAmount: "",
};

describe("countIncomeCategories", () => {
	it("counts pension, employment and other income once each", () => {
		expect(
			countIncomeCategories(
				["pension", "pension_retirement", "employment_employed", "other_sick"],
				false,
			),
		).toBe(3);
	});

	it("counts legacy other-income sources", () => {
		expect(countIncomeCategories(["pension", "Kindergeld"], false)).toBe(2);
	});

	it("trusts the employment source over a stale employed flag", () => {
		expect(
			countIncomeCategories(["pension", "employment_unemployed"], true),
		).toBe(1);
	});

	it("falls back to the employed flag without an employment source", () => {
		expect(countIncomeCategories(["pension"], true)).toBe(2);
	});
});

describe("calculateTotalIncome", () => {
	it("returns null when nothing was answered", () => {
		expect(calculateTotalIncome(noIncome)).toBeNull();
	});

	it("returns null when a selected income has no amount", () => {
		expect(
			calculateTotalIncome({
				...noIncome,
				pensionTypes: ["retirement"],
				pensionAmount: "",
				employmentType: "employed",
				employmentAmount: "1000",
			}),
		).toBeNull();
	});

	it("sums the selected incomes and ignores categories answered with none", () => {
		expect(
			calculateTotalIncome({
				pensionTypes: ["retirement"],
				pensionAmount: "650,50",
				employmentType: "unemployed",
				employmentAmount: "",
				otherIncomeTypes: ["none"],
				otherIncomeAmount: "",
			}),
		).toBe(650.5);
	});

	it("returns 0 when every category is answered with none", () => {
		expect(
			calculateTotalIncome({
				...noIncome,
				pensionTypes: ["none"],
				employmentType: "none",
				otherIncomeTypes: ["none"],
			}),
		).toBe(0);
	});
});

describe("withPensionSources", () => {
	it("stores each pension type as its own source", () => {
		expect(
			withPensionSources(["employment_employed"], ["retirement", "reduced"]),
		).toEqual([
			"employment_employed",
			"pension",
			"pension_retirement",
			"pension_reduced",
		]);
	});
});
