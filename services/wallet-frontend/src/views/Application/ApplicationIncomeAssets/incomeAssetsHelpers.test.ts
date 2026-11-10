import { describe, it, expect } from "vitest";
import {
	OTHER_INCOME_TYPES,
	PENSION_INCOME_TYPES,
	employmentRows,
	incomeRows,
	storedEmploymentIncome,
	storedIncomeAmounts,
	storedIncomeOptions,
	totalIncome,
} from "./incomeAssetsHelpers";

describe("incomeRows", () => {
	it("writes every line of the page, 0 for the ones not chosen", () => {
		expect(
			incomeRows(PENSION_INCOME_TYPES, ["retirement"], {
				retirement: "650,50",
			}),
		).toEqual([
			{ incomeType: "Old-Age Pension", monthlyAmount: 650.5 },
			{ incomeType: "Reduced Earning Capacity Pension", monthlyAmount: 0 },
			{ incomeType: "Survivor Pension", monthlyAmount: 0 },
		]);
	});

	it("writes 0 on every line for none", () => {
		expect(
			incomeRows(OTHER_INCOME_TYPES, ["none"], {}).map((r) => r.monthlyAmount),
		).toEqual([0, 0, 0]);
	});

	it("keeps a chosen line without an amount", () => {
		expect(incomeRows(OTHER_INCOME_TYPES, ["alimony"], {})[1]).toEqual({
			incomeType: "Alimony",
			monthlyAmount: null,
		});
	});

	it("writes nothing while nothing is chosen", () => {
		expect(incomeRows(PENSION_INCOME_TYPES, [], {})).toEqual([]);
	});
});

describe("storedIncomeOptions", () => {
	it("chooses the lines with income", () => {
		const entries = [
			{ incomeType: "Old-Age Pension", monthlyAmount: 650 },
			{ incomeType: "Survivor Pension", monthlyAmount: 0 },
		];
		expect(storedIncomeOptions(PENSION_INCOME_TYPES, entries)).toEqual([
			"retirement",
		]);
		expect(storedIncomeAmounts(PENSION_INCOME_TYPES, entries)).toEqual({
			retirement: "650",
		});
	});

	it("reads stored zeros as none and no rows as unanswered", () => {
		expect(
			storedIncomeOptions(OTHER_INCOME_TYPES, [
				{ incomeType: "Alimony", monthlyAmount: 0 },
			]),
		).toEqual(["none"]);
		expect(storedIncomeOptions(OTHER_INCOME_TYPES, [])).toEqual([]);
	});

	it("ignores the rows of other household members", () => {
		expect(
			storedIncomeOptions(PENSION_INCOME_TYPES, [
				{
					incomeType: "Old-Age Pension",
					monthlyAmount: 900,
					personSortOrder: 0,
				},
			]),
		).toEqual([]);
	});
});

describe("employment income", () => {
	it("puts the amount of the self-employed on their own line", () => {
		const rows = employmentRows("self_employed", "1200");
		expect(rows).toEqual([
			{ incomeType: "Employment", monthlyAmount: 0 },
			{ incomeType: "Other Self-Employment", monthlyAmount: 1200 },
		]);
		expect(storedEmploymentIncome(rows)).toEqual({
			isSelfEmployed: true,
			amount: "1200",
		});
	});

	it("writes 0 without employment and nothing while unanswered", () => {
		expect(
			employmentRows("unemployed", "500").map((r) => r.monthlyAmount),
		).toEqual([0, 0]);
		expect(employmentRows("", "")).toEqual([]);
	});
});

describe("totalIncome", () => {
	it("adds up the rows", () => {
		expect(
			totalIncome([
				...incomeRows(PENSION_INCOME_TYPES, ["retirement"], {
					retirement: "650",
				}),
				...employmentRows("employed", "100"),
			]),
		).toBe(750);
	});

	it("returns null while nothing is answered or an amount is missing", () => {
		expect(totalIncome([])).toBeNull();
		expect(
			totalIncome(incomeRows(OTHER_INCOME_TYPES, ["alimony"], {})),
		).toBeNull();
	});
});
