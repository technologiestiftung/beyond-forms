import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import deEligibility from "../src/locales/de/eligibility.json" with { type: "json" };
import enEligibility from "../src/locales/en/eligibility.json" with { type: "json" };
import {
	answerChoice,
	answerDate,
	answerNumber,
	completePensionerCheck,
	fillNumber,
	submitAnswer,
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

test.describe("Eligibility Navigator - Desktop layout", () => {
	test.skip(({ isMobile }) => isMobile, "Desktop-only layout");

	const expectFitsViewport = async (page: Page) => {
		const metrics = await page.evaluate(() => {
			const main =
				document.getElementById("main-content") ?? document.documentElement;
			const bottomOf = (testId: string) =>
				document
					.querySelector(`[data-testid="${testId}"]`)
					?.getBoundingClientRect().bottom ?? 0;
			const optionBottoms = Array.from(
				document.querySelectorAll('[data-testid^="option-"]'),
			).map((el) => el.getBoundingClientRect().bottom);
			return {
				viewportHeight: window.innerHeight,
				overflowX: main.scrollWidth - main.clientWidth,
				pageOverflowX:
					document.documentElement.scrollWidth -
					document.documentElement.clientWidth,
				lastOptionBottom: Math.max(0, ...optionBottoms),
				nextBottom: bottomOf("next-button"),
				backBottom: bottomOf("back-button"),
			};
		});

		expect(metrics.overflowX).toBe(0);
		expect(metrics.pageOverflowX).toBe(0);
		expect(metrics.lastOptionBottom).toBeLessThanOrEqual(
			metrics.viewportHeight,
		);
		expect(metrics.nextBottom).toBeLessThanOrEqual(metrics.viewportHeight);
		expect(metrics.backBottom).toBeLessThanOrEqual(metrics.viewportHeight);
	};

	for (const viewport of [
		{ width: 1280, height: 720 },
		{ width: 1920, height: 1080 },
	]) {
		test(`questions fit without scrolling and result has no horizontal overflow at ${viewport.width}px`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			await page.goto("/");
			await page.evaluate(() => {
				window.sessionStorage.clear();
				window.localStorage.clear();
			});
			await page.reload();
			await page.getByTestId("start-button").click();

			const steps: Array<(page: Page) => Promise<unknown>> = [
				(p) => p.getByTestId("option-single_parent").click(),
				(p) => p.getByTestId("child-date-input-0").fill("2018-03-01"),
				(p) => p.getByTestId("dob-date-input").fill("1990-05-01"),
				(p) => p.getByTestId("option-yes").click(),
				(p) => p.getByTestId("option-yes").click(),
				(p) => fillNumber(p, 2500),
				(p) => p.getByTestId("option-full").click(),
				(p) => fillNumber(p, 2000),
				(p) => fillNumber(p, 900),
				(p) => p.getByTestId("option-under_5000").click(),
				(p) => p.getByTestId("option-no").click(),
				(p) => p.getByTestId("option-non_eu").click(),
				(p) => p.getByTestId("option-no").click(),
			];

			for (const answer of steps) {
				await expect(page.getByTestId("question-card")).toBeVisible();
				await expectFitsViewport(page);
				await answer(page);
				await submitAnswer(page);
			}

			await expect(page).toHaveURL(/\/eligibility-check\/result/);
			await expect(page.getByTestId("benefit-kinderzuschlag")).toBeVisible();
			const overflowX = await page.evaluate(() => {
				const main =
					document.getElementById("main-content") ?? document.documentElement;
				return main.scrollWidth - main.clientWidth;
			});
			expect(overflowX).toBe(0);
			await expect(
				page.getByRole("heading", { level: 1, name: "Dein Ergebnis" }),
			).toBeVisible();
		});
	}

	test("focus moves from the top bar through the answers to Weiter", async ({
		page,
		browserName,
	}) => {
		test.skip(
			browserName === "webkit",
			"Safari skips buttons on Tab by default",
		);
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto("/");
		await page.evaluate(() => {
			window.sessionStorage.clear();
			window.localStorage.clear();
		});
		await page.reload();
		await page.getByTestId("start-button").click();
		await page.getByTestId("option-single").click();

		await page.getByTestId("back-button").focus();
		await page.keyboard.press("Tab");
		await expect(
			page.getByTestId("language-switcher").getByRole("button"),
		).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(
			page.getByTestId("option-single").locator("input"),
		).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(page.getByTestId("next-button")).toBeFocused();

		await page.getByTestId("next-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/birthdate/);
		await page.getByTestId("back-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/household/);
	});
});
