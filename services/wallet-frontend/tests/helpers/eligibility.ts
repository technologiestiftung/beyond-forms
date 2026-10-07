import { expect, type Page } from "@playwright/test";

/** Waits for the next question to replace the current one, so the next fill hits the new input. */
export async function submitAnswer(page: Page) {
	const current = page.url();
	await page.getByTestId("next-button").click();
	await page.waitForURL((url) => url.toString() !== current);
}

export async function answerChoice(page: Page, option: string) {
	await page.getByTestId(`option-${option.toLowerCase()}`).click();
	await submitAnswer(page);
}

export async function fillNumber(page: Page, amount: number) {
	const input = page.getByTestId("number-input");
	// Consecutive number questions share the test id; the empty one is the freshly rendered card.
	await expect(input).toHaveValue("");
	await input.fill(String(amount));
}

export async function answerNumber(page: Page, amount: number) {
	await fillNumber(page, amount);
	await submitAnswer(page);
}

export async function answerDate(page: Page, isoDate: string) {
	await page.getByTestId("dob-date-input").fill(isoDate);
	await submitAnswer(page);
}

/** A pensioner living alone with a small income, which leads to Grundsicherung im Alter. */
export async function completePensionerCheck(
	page: Page,
	dateOfBirth = "1955-01-01",
) {
	await page.getByTestId("start-button").click();
	await answerChoice(page, "single");
	await answerDate(page, dateOfBirth);
	await answerChoice(page, "yes");
	await answerChoice(page, "no");
	await answerNumber(page, 800);
	await answerNumber(page, 600);
	await answerChoice(page, "under_5000");
	await answerChoice(page, "no");
	await answerChoice(page, "german");
	await expect(page).toHaveURL(/\/eligibility-check\/result/);
}
