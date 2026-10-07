import { test, expect, type Page } from "@playwright/test";
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
		test(`questions and result fit without scrolling at ${viewport.width}px`, async ({
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

			const answers = [
				"option-eu_5_plus",
				"option-yes",
				null,
				"option-reduced_earning_capacity",
				"option-soon_insufficient",
				"option-no",
			];

			for (const answer of answers) {
				await expect(page.getByTestId("question-card")).toBeVisible();
				await expectFitsViewport(page);
				if (answer) {
					await page.getByTestId(answer).click();
				} else {
					await page.getByTestId("dob-date-input").fill("1955-01-01");
				}
				await page.getByTestId("next-button").click();
			}

			await expect(page).toHaveURL(/\/eligibility-check\/result/);
			await expect(page.getByTestId("outcome-card")).toBeVisible();
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
		await page.getByTestId("option-german").click();

		await page.getByTestId("back-button").focus();
		await page.keyboard.press("Tab");
		await expect(
			page.getByTestId("language-switcher").getByRole("button"),
		).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(
			page.getByTestId("option-german").locator("input"),
		).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(page.getByTestId("next-button")).toBeFocused();

		await page.getByTestId("next-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/germany/);
		await page.getByTestId("back-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/nationality/);
	});
});
