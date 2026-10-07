import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import deEligibility from "../src/locales/de/eligibility.json" with { type: "json" };
import enEligibility from "../src/locales/en/eligibility.json" with { type: "json" };
import {
	answerChoice,
	answerDate,
	answerNumber,
	completePensionerCheck,
} from "./helpers/eligibility";

test.describe("Eligibility Navigator - Principal Journey Audit", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.evaluate(() => {
			window.sessionStorage.clear();
			window.localStorage.clear();
		});
		await page.reload();
	});

	test("Start Screen: Check path leads to eligibility check", async ({
		page,
	}) => {
		await expect(page.getByTestId("start-button")).toBeVisible();
		await page.getByTestId("start-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/household/);
	});

	test("Start Screen: Direct path leads to login", async ({ page }) => {
		await expect(page.getByTestId("promo-card-start-button")).toBeVisible();
		await page.getByTestId("promo-card-start-button").click();
		await expect(page).toHaveURL(/\/auth\?mode=login/);
	});

	test("Language Switcher: Toggle between DE and EN on Start Screen", async ({
		page,
	}) => {
		await expect(page.getByTestId("start-button")).toBeVisible();
		await page.getByTestId("language-switcher").click();
		await page.getByText("EN", { exact: true }).click();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			enEligibility.start_screen.title,
		);
		await page.getByTestId("language-switcher").click();
		await page.getByText("DE", { exact: true }).click();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			deEligibility.start_screen.title,
		);
	});

	test("Language Switcher: Mid-flow language switching", async ({ page }) => {
		await page.getByTestId("start-button").click();

		await expect(
			page.getByText(/Wer lebt in Deinem Haushalt\?/i),
		).toBeVisible();
		await page.getByTestId("language-switcher").click();
		await page.getByText("EN", { exact: true }).click();
		await expect(
			page.getByText(/Who lives in your household\?/i),
		).toBeVisible();

		await answerChoice(page, "single");

		await expect(page.getByText(/When were you born\?/i)).toBeVisible();
		await page.getByTestId("language-switcher").click();
		await page.getByText("DE", { exact: true }).click();
		await expect(page.getByText(/Wann bist Du geboren\?/i)).toBeVisible();
	});

	test("Persona Journey: Pensioner living alone", async ({ page }) => {
		await completePensionerCheck(page);

		await expect(page.getByTestId("outcome-title")).toContainText(
			/Ersteinschätzung|initial assessment/i,
		);
		await expect(
			page.getByTestId("benefit-grundsicherung_alter"),
		).toHaveAttribute("data-status", "LIKELY");
		await expect(
			page.getByTestId("benefit-grundsicherungsgeld"),
		).toHaveAttribute("data-status", "NO");

		await page.waitForTimeout(1000);
		const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test("Persona Journey: Working single parent", async ({ page }) => {
		await page.getByTestId("start-button").click();

		await answerChoice(page, "single_parent");
		await page.getByTestId("child-date-input-0").fill("2018-03-01");
		await page.getByTestId("next-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/birthdate/);
		await answerDate(page, "1990-05-01");
		await answerChoice(page, "yes");
		await answerChoice(page, "yes");
		await answerNumber(page, 2500);
		await answerChoice(page, "full");
		await answerNumber(page, 2000);
		await answerNumber(page, 900);
		await answerChoice(page, "under_5000");
		await answerChoice(page, "no");
		await answerChoice(page, "non_eu");
		await answerChoice(page, "no");

		await expect(page).toHaveURL(/\/eligibility-check\/result/);
		await expect(page.getByTestId("benefit-kinderzuschlag")).toHaveAttribute(
			"data-status",
			"POSSIBLE",
		);
		await expect(page.getByTestId("benefit-wohngeld")).toHaveAttribute(
			"data-status",
			"POSSIBLE",
		);
		await expect(page.getByTestId("residence-hint")).toBeVisible();
	});

	test("Persona Journey: Not living in Germany ends the check", async ({
		page,
	}) => {
		await page.getByTestId("start-button").click();

		await answerChoice(page, "single");
		await answerDate(page, "1955-01-01");
		await answerChoice(page, "no");

		await expect(page).toHaveURL(/\/eligibility-check\/result/);
		await expect(page.getByTestId("outcome-title")).toContainText(
			/keinen Anspruch|not entitled/i,
		);
	});

	test("Changing an answer re-routes the check", async ({ page }) => {
		await page.getByTestId("start-button").click();

		await answerChoice(page, "single_parent");
		await expect(page).toHaveURL(/\/eligibility-check\/children/);

		await page.getByTestId("back-button").click();
		await answerChoice(page, "single");
		await expect(page).toHaveURL(/\/eligibility-check\/birthdate/);
	});

	test("UX: State should reset when starting over from Landing Page", async ({
		page,
	}) => {
		await completePensionerCheck(page);
		await page.getByText(/Von vorne anfangen|Start over/i).click();

		const landingCta = page.getByTestId("start-button");
		await expect(landingCta).toBeVisible({ timeout: 15000 });
		await landingCta.click();

		await expect(page).toHaveURL(/\/eligibility-check\/household/);
		await expect(
			page.getByTestId("option-single").locator("input"),
		).not.toBeChecked();
	});
});
