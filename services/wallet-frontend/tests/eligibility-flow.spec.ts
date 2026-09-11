import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { completeEligibilityCheck } from "./helpers/eligibility";

test.describe("Anspruchsradar - Principal Journey Audit", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.evaluate(() => {
			window.sessionStorage.clear();
			window.localStorage.clear();
		});
		await page.reload();
	});

	test("Start Screen: Verify content and start action", async ({ page }) => {
		await expect(page.getByTestId("start-button")).toBeVisible();
		await page.getByTestId("start-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/household/);
	});

	test("Language Switcher: Toggle between DE and EN on Start Screen", async ({
		page,
	}) => {
		await expect(page.getByTestId("start-button")).toBeVisible();
		await page.getByTestId("language-switcher").click();
		await page.getByText("EN", { exact: true }).click();
		await expect(
			page.getByText(/Check your entitlement to social benefits/i),
		).toBeVisible();
		await page.getByTestId("language-switcher").click();
		await page.getByText("DE", { exact: true }).click();
		await expect(
			page.getByText(/Deinen Anspruch auf Sozialleistungen prüfen/i),
		).toBeVisible();
	});

	test("Language Switcher: Mid-flow language switching", async ({ page }) => {
		await page.getByTestId("start-button").click();

		await expect(
			page.getByText(
				new RegExp(
					[
						"Wer lebt in Deinem Haushalt\\?",
						"Who lives in your household\\?",
					].join("|"),
					"i",
				),
			),
		).toBeVisible();
		await page.getByTestId("language-switcher").click();
		await page.getByText("EN", { exact: true }).click();
		await expect(page.getByText(/Who lives in your household/i)).toBeVisible();

		await page.getByTestId("option-single").click();
		await page.getByTestId("next-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/birthdate/);
	});

	test("Skips the children question for someone living alone", async ({
		page,
	}) => {
		await page.getByTestId("start-button").click();
		await page.getByTestId("option-single").click();
		await page.getByTestId("next-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/birthdate/);
	});

	test("Asks for children when the household has them", async ({ page }) => {
		await page.getByTestId("start-button").click();
		await page.getByTestId("option-single_parent").click();
		await page.getByTestId("next-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/children/);

		await page.getByTestId("child-date-0").fill("11.02.2020");
		await page.getByTestId("add-child").click();
		await expect(page.getByTestId("child-date-1")).toBeVisible();
		await page.getByTestId("remove-child-1").click();
		await expect(page.getByTestId("child-date-1")).toHaveCount(0);
		await page.getByTestId("next-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/birthdate/);
	});

	/**
	 * The reason the date field is a masked text input rather than `<input type="date">`:
	 * a native picker takes its order from the browser's locale, so this is the assertion
	 * that would have caught mm/dd/yyyy showing up in the German UI.
	 */
	test("Dates are entered day-first in the German interface", async ({
		page,
	}) => {
		await page.getByTestId("start-button").click();
		await page.getByTestId("option-single").click();
		await page.getByTestId("next-button").click();

		const dob = page.getByTestId("dob-date-input");
		await expect(dob).toHaveAttribute("placeholder", "TT.MM.JJJJ");
		await dob.fill("15.01.1994");
		await expect(dob).toHaveValue("15.01.1994");
		await page.getByTestId("next-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/germany/);
	});

	test("Rejects an impossible date and keeps the next button disabled", async ({
		page,
	}) => {
		await page.getByTestId("start-button").click();
		await page.getByTestId("option-single").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("dob-date-input").fill("30.02.2020");
		await page.getByTestId("dob-date-input").blur();
		await expect(page.getByTestId("next-button")).toBeDisabled();
	});

	test("Completes the check and reaches the result", async ({ page }) => {
		await completeEligibilityCheck(page);
		await expect(page.getByTestId("result-cta")).toBeVisible();
		// Every listed benefit is one Klaro can actually file an application for.
		const cards = page.getByTestId(/^assessment-/);
		expect(await cards.count()).toBeGreaterThan(0);
	});

	test("Refers to the Sozialamt when nothing matches", async ({ page }) => {
		await completeEligibilityCheck(page, {
			grossIncome: "5000",
			netIncome: "4000",
			warmRent: "700",
			assets: "over_25000",
		});
		await expect(page.getByTestId("result-referral")).toBeVisible();
	});

	test("Back navigation returns to the previous question", async ({ page }) => {
		await page.getByTestId("start-button").click();
		await page.getByTestId("option-single").click();
		await page.getByTestId("next-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/birthdate/);

		await page.getByTestId("back-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/household/);
		// The answer survives the trip back.
		await expect(
			page.getByTestId("option-single").locator("input"),
		).toBeChecked();
	});

	test("An unfinished check cannot reach the result page", async ({ page }) => {
		await page.goto("/eligibility-check/result");
		await expect(page).toHaveURL(/\/eligibility-check\/household/);
	});

	test("Result page has no accessibility violations", async ({ page }) => {
		await completeEligibilityCheck(page);
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);
	});
});
