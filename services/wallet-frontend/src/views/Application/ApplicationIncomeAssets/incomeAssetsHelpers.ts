import type { IncomeEntry } from "../../../schemas/profile.schema";

export const END_PAGE = 8;

const STEP_TO_PAGE_MAP: Record<string, number> = {
	step_applicant_benefits_awaiting_decision: 1,
	step_applicant_benefits_awaiting_decision_details: 1,
	step_previous_benefits: 2,
	step_previous_benefits_details: 2,
	step_applicant_pension: 3,
	step_applicant_employment: 4,
	step_applicant_employment_details: 4,
	step_applicant_income_other: 5,
	step_applicant_expected_payments: 6,
	step_applicant_expected_payments_details: 6,
	step_applicant_bank_details: 7,
};

export interface WizardSaveResult {
	data?: { wizard_evaluation?: { next_step?: string | null } | null };
}

export const getNextPage = (
	result: WizardSaveResult,
	fallbackPage: number,
): number => {
	const nextStepId = result.data?.wizard_evaluation?.next_step;
	if (!nextStepId) {
		return fallbackPage;
	}
	if (nextStepId === "END") {
		return END_PAGE;
	}
	return STEP_TO_PAGE_MAP[nextStepId] ?? fallbackPage;
};

export const parseAmount = (value: string) => Number(value.replace(",", "."));

export const isInvalidAmount = (value: string) => {
	if (value.trim() === "") {
		return false;
	}
	const amount = parseAmount(value);
	return isNaN(amount) || amount < 0;
};

export const toggleOption = (list: string[], value: string): string[] => {
	if (value === "none") {
		return ["none"];
	}
	return list.includes(value)
		? list.filter((item) => item !== value)
		: [...list.filter((item) => item !== "none"), value];
};

export const isWithoutEmployment = (employmentType: string) =>
	employmentType === "unemployed" || employmentType === "none";

/** The wizard's options and the income line of the form each one fills. */
export const PENSION_INCOME_TYPES: Record<string, string> = {
	retirement: "Old-Age Pension",
	reduced: "Reduced Earning Capacity Pension",
	survivor: "Survivor Pension",
};

export const OTHER_INCOME_TYPES: Record<string, string> = {
	sick_pay: "Health Insurance Benefits",
	alimony: "Alimony",
	other: "Rental and Leasing",
};

const EMPLOYMENT_INCOME_TYPES: Record<string, string> = {
	employed: "Employment",
	self_employed: "Other Self-Employment",
};

/** An amount the user typed per option, e.g. `{ retirement: "650" }`. */
export type IncomeAmounts = Record<string, string>;

const toMonthlyAmount = (amount: string | undefined) =>
	!amount || amount.trim() === "" ? null : parseAmount(amount);

const applicantRow = (entries: IncomeEntry[], incomeType: string) =>
	entries.find(
		(row) =>
			row.incomeType === incomeType && !Number.isInteger(row.personSortOrder),
	);

/**
 * The rows a page writes: every line it asks about, with the typed amount for
 * the chosen options and 0 for the others. A chosen option without an amount
 * is stored without one; a page answered with nothing writes nothing.
 */
export const incomeRows = (
	incomeTypes: Record<string, string>,
	chosen: string[],
	amounts: IncomeAmounts,
): IncomeEntry[] =>
	chosen.length === 0
		? []
		: Object.entries(incomeTypes).map(([option, incomeType]) => ({
				incomeType,
				monthlyAmount: chosen.includes(option)
					? toMonthlyAmount(amounts[option])
					: 0,
			}));

/** The options the stored rows answer: those with income, or "none" when every stored line is 0. */
export const storedIncomeOptions = (
	incomeTypes: Record<string, string>,
	entries: IncomeEntry[],
): string[] => {
	const stored = Object.entries(incomeTypes).flatMap(([option, incomeType]) => {
		const row = applicantRow(entries, incomeType);
		return row ? [{ option, hasIncome: row.monthlyAmount !== 0 }] : [];
	});
	if (stored.length === 0) {
		return [];
	}
	const withIncome = stored.filter((s) => s.hasIncome).map((s) => s.option);
	return withIncome.length > 0 ? withIncome : ["none"];
};

export const hasInvalidAmount = (chosen: string[], amounts: IncomeAmounts) =>
	chosen.some((option) => isInvalidAmount(amounts[option] ?? ""));

export const storedIncomeAmounts = (
	incomeTypes: Record<string, string>,
	entries: IncomeEntry[],
): IncomeAmounts =>
	Object.fromEntries(
		Object.entries(incomeTypes).flatMap(([option, incomeType]) => {
			const amount = applicantRow(entries, incomeType)?.monthlyAmount;
			return amount ? [[option, String(amount)]] : [];
		}),
	);

/** Employees and trainees earn on the employment line, the self-employed on their own. */
export const employmentRows = (
	employmentType: string,
	amount: string,
): IncomeEntry[] => {
	if (employmentType === "") {
		return [];
	}
	const option =
		employmentType === "self_employed" ? "self_employed" : "employed";
	const chosen = isWithoutEmployment(employmentType) ? ["none"] : [option];
	return incomeRows(EMPLOYMENT_INCOME_TYPES, chosen, { [option]: amount });
};

/** The stored employment income: the self-employed line if it has any, else the employment line. */
export const storedEmploymentIncome = (
	entries: IncomeEntry[],
): { isSelfEmployed: boolean; amount: string } => {
	const amounts = storedIncomeAmounts(EMPLOYMENT_INCOME_TYPES, entries);
	const isSelfEmployed = storedIncomeOptions(
		EMPLOYMENT_INCOME_TYPES,
		entries,
	).includes("self_employed");
	return {
		isSelfEmployed,
		amount: amounts[isSelfEmployed ? "self_employed" : "employed"] ?? "",
	};
};

/** The total of all rows, or null while nothing is answered or a row has no amount. */
export const totalIncome = (rows: IncomeEntry[]): number | null =>
	rows.length === 0 || rows.some((row) => row.monthlyAmount === null)
		? null
		: rows.reduce((sum, row) => sum + (row.monthlyAmount ?? 0), 0);
