import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Eligibility Navigator - Principal Journey Audit", () => {
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
		await expect(page).toHaveURL(/\/eligibility-check\/nationality/);
	});

	test("Language Switcher: Toggle between DE and EN on Start Screen", async ({
		page,
	}) => {
		await expect(page.getByTestId("start-button")).toBeVisible();
		await page.getByTestId("language-switcher").click();
		await page.getByText("EN", { exact: true }).click();
		await expect(
			page.getByText(/Check Grundsicherung easily and quickly/i),
		).toBeVisible();
		await page.getByTestId("language-switcher").click();
		await page.getByText("DE", { exact: true }).click();
		await expect(
			page.getByText(
				/Schnell und einfach Deinen Anspruch auf Grundsicherung prüfen/i,
			),
		).toBeVisible();
	});

	test("Language Switcher: Mid-flow language switching", async ({ page }) => {
		await page.getByTestId("start-button").click();

		await expect(
			page.getByText(
				new RegExp(
					[
						"Was trifft auf Dich zu\\?",
						"Which of the following applies to you\\?",
					].join("|"),
					"i",
				),
			),
		).toBeVisible();
		await page.getByTestId("language-switcher").click();
		await page.getByText("EN", { exact: true }).click();
		await expect(
			page.getByText(/Which of the following applies to you/i),
		).toBeVisible();

		await page.getByTestId("option-german").click();
		await page.getByTestId("next-button").click();

		await expect(page.getByText(/Do you live in Germany/i)).toBeVisible();
		await page.getByTestId("language-switcher").click();
		await page.getByText("DE", { exact: true }).click();
		await expect(page.getByText(/Wohnst Du in Deutschland/i)).toBeVisible();
	});

	const fillDateOfBirth = async ({
		page,
		day = "01",
		month = "01",
		year = "1955",
	}: {
		page: import("@playwright/test").Page;
		day?: string;
		month?: string;
		year?: string;
	}) => {
		const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
		await page.getByTestId("dob-date-input").fill(isoDate);
	};

	test("Persona Journey: Sandor (Eligible Senior) - DE Path", async ({
		page,
	}) => {
		await page.getByTestId("start-button").click();

		await page.getByTestId("option-german").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-yes").click();
		await page.getByTestId("next-button").click();

		await fillDateOfBirth({ page });
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-old_age").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-not_sufficient").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-no").click();
		await page.getByTestId("next-button").click();

		await expect(page).toHaveURL(/\/eligibility-check\/result/);
		await expect(page.getByTestId("outcome-title")).toContainText(
			/Du könntest|You could be entitled/i,
		);

		await page.waitForTimeout(1000);
		const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test("Persona Journey: No pension (Other Benefit Path)", async ({ page }) => {
		await page.getByTestId("language-switcher").click();
		await page.getByText("EN", { exact: true }).click();
		await page.getByTestId("start-button").click();

		await page.getByTestId("option-german").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-yes").click();
		await page.getByTestId("next-button").click();

		await fillDateOfBirth({ page });
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-none").click();
		await page.getByTestId("next-button").click();

		await expect(page).toHaveURL(/\/eligibility-check\/result/);
		await expect(page.getByTestId("outcome-title")).toContainText(
			/not a good fit|passt im Moment eher nicht/i,
		);
	});

	test("Persona Journey: Sozialamt referral", async ({ page }) => {
		await page.getByTestId("start-button").click();

		await page.getByTestId("option-none").click();
		await page.getByTestId("next-button").click();

		await expect(page).toHaveURL(/\/eligibility-check\/result/);
		await expect(page.getByTestId("outcome-title")).toContainText(
			/Sozialamt|Social Services Office/i,
		);

		const cta = page.getByTestId("outcome-cta");
		await expect(cta).toHaveAttribute(
			"href",
			"https://service.berlin.de/standorte/sozialamt/",
		);
		await expect(cta).toHaveAttribute("target", "_blank");
	});

	test("Empathetic UX: Non-Destructive State (Undo/Redo)", async ({ page }) => {
		await page.getByTestId("start-button").click();

		await page.getByTestId("option-german").click();
		await page.getByTestId("next-button").click();
		await page.getByTestId("option-yes").click();
		await page.getByTestId("next-button").click();
		await fillDateOfBirth({ page });
		await page.getByTestId("next-button").click();
		await page.getByTestId("option-none").click();
		await page.getByTestId("next-button").click();

		await expect(page.getByTestId("outcome-title")).toBeVisible();

		await page.getByTestId("back-button").click();
		await page.getByTestId("back-button").click();
		await page.getByTestId("back-button").click();
		await page.getByTestId("back-button").click();

		await page.getByTestId("option-none").click();
		await page.getByTestId("next-button").click();

		await expect(page.getByTestId("outcome-title")).toContainText(
			/Sozialamt|Social Services Office/i,
		);

		await page.getByText(/Von vorne anfangen|Start over/i).click();

		await page.evaluate(() => {
			window.localStorage.clear();
			window.sessionStorage.clear();
		});

		await page.goto("/");

		const landingCta = page.getByTestId("start-button");
		await expect(landingCta).toBeVisible({ timeout: 15000 });
		await landingCta.click();

		await expect(page).toHaveURL(/\/eligibility-check\/nationality/);

		await expect(
			page.getByTestId("option-german").locator("input"),
		).not.toBeChecked();
	});

	test("UX: State should reset when starting over from Landing Page", async ({
		page,
	}) => {
		await page.getByTestId("start-button").click();

		await page.getByTestId("option-german").click();
		await expect(
			page.getByTestId("option-german").locator("input"),
		).toBeChecked();

		await page.goto("/");
		await page.getByTestId("start-button").click();

		await expect(
			page.getByTestId("option-german").locator("input"),
		).not.toBeChecked();
	});
});
