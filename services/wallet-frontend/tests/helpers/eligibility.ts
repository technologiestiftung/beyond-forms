import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Walks the Anspruchsradar from the start screen to the result page.
 *
 * One helper rather than a copy per spec: the question catalogue is configuration, so its
 * length and order change with product decisions, and five hand-rolled walkthroughs is how
 * the previous suite ended up asserting against a flow that no longer existed.
 *
 * The default path is a single applicant, which skips the children and partner-income
 * questions. Dates are typed the way the German UI asks for them, TT.MM.JJJJ — the field is
 * a masked text input, not a native date picker, precisely so that notation is guaranteed.
 */
export interface EligibilityAnswers {
	/** Under the work-capacity income threshold keeps that question in the path. */
	grossIncome?: string;
	netIncome?: string;
	warmRent?: string;
	dateOfBirth?: string;
	employed?: boolean;
	receivesBenefits?: boolean;
	assets?:
		| "under_5000"
		| "from_5000_to_15000"
		| "from_15000_to_25000"
		| "over_25000";
	workCapacity?: "full" | "temporarily_reduced" | "permanently_reduced";
}

const next = async (page: Page) => {
	await page.getByTestId("next-button").click();
};

const choose = async (page: Page, option: string) => {
	await page.getByTestId(`option-${option}`).click();
	await next(page);
};

const fillNumber = async (page: Page, value: string) => {
	await page.getByTestId("number-input").fill(value);
	await next(page);
};

export const completeEligibilityCheck = async (
	page: Page,
	answers: EligibilityAnswers = {},
) => {
	const {
		grossIncome = "900",
		netIncome = "1100",
		warmRent = "650",
		dateOfBirth = "15.01.1994",
		employed = true,
		receivesBenefits = false,
		assets = "under_5000",
		workCapacity = "full",
	} = answers;

	await page.getByTestId("start-button").click();
	await expect(page).toHaveURL(/\/eligibility-check\/household/);

	await choose(page, "single");
	await page.getByTestId("dob-date-input").fill(dateOfBirth);
	await next(page);
	await choose(page, "yes"); // lives in Germany
	await choose(page, employed ? "yes" : "no");
	await fillNumber(page, grossIncome);

	// Skipped above the income threshold, where the flow records FULL by itself.
	if (Number(grossIncome) <= 1000) {
		await choose(page, workCapacity);
	}

	await fillNumber(page, netIncome);
	await fillNumber(page, warmRent);
	await choose(page, assets);
	await choose(page, receivesBenefits ? "yes" : "no");
	await choose(page, "de_eu");

	await expect(page).toHaveURL(/\/eligibility-check\/result/);
	await expect(page.getByTestId("result-disclaimer")).toBeVisible();
};
