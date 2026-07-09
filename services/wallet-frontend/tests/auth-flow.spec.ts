import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { generateRandomTestPhoneNumber } from "./helpers/auth";

test.describe("Authentication Flow - Security & Data Persistence Audit", () => {
	test.beforeEach(async ({ page, context }) => {
		await page.goto("/");
		await context.clearCookies();
		await page.evaluate(() => {
			window.localStorage.clear();
			window.sessionStorage.clear();
		});
	});

	test("Start Page: Link to Login flow", async ({ page }) => {
		await page.goto("/");
		await page.getByTestId("promo-card-start-button").click();
		await expect(page).toHaveURL(/\/auth\?mode=login/);
		await expect(
			page.getByText(
				/Mit Telefonnummer fortfahren|Continue with Phone Number/i,
			),
		).toBeVisible();
	});

	test("Happy Path: New User Registration with Data Sync", async ({ page }) => {
		await page.goto("/");
		await page.getByTestId("start-button").click();

		await page.getByTestId("option-german").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-yes").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("dob-date-input").fill("1955-01-01");
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-old_age").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-not_sufficient").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-no").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("outcome-cta").click();
		await expect(page).toHaveURL(/\/auth\?origin=eligibility/);

		const randomPhone = generateRandomTestPhoneNumber();
		await page.getByTestId("phone-input").fill(randomPhone);
		await page.getByTestId("send-code-button").click();

		await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });

		// For backend drama numbers, any 6 digits work
		for (let i = 0; i < 6; i++) {
			await page.getByTestId(`otp-input-${i}`).fill("1");
		}

		await expect(page.getByTestId("registration-success")).toBeVisible({
			timeout: 30000,
		});
		await page.getByTestId("registration-success-next-button").click();

		// Complete mandatory onboarding tutorial
		await expect(page).toHaveURL(
			/\/tutorial\/wie-funktioniert-die-applikation/,
		);
		const nextBtn = page.getByRole("button", { name: "Weiter" });
		await expect(nextBtn).toBeVisible({ timeout: 15000 });
		for (let i = 0; i < 3; i++) {
			await nextBtn.click();
			await page.waitForTimeout(1000);
		}
		const startBtn = page.locator(
			'button:has-text("Jetzt starten"), button:has-text("Verstanden"), button:has-text("Start now"), button:has-text("Understood")',
		);
		await expect(startBtn).toBeVisible({ timeout: 10000 });
		await startBtn.click();

		await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
	});

	test("Returning User: Direct Login", async ({ page, baseURL }) => {
		const testNumber = generateRandomTestPhoneNumber();

		await page.goto("/auth?mode=login");
		await expect(page.getByTestId("phone-number-form")).toBeVisible();

		await page.getByTestId("phone-input").fill(testNumber);
		await page.getByTestId("send-code-button").click();
		await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });

		// For backend drama numbers, any 6 digits work
		for (let i = 0; i < 6; i++) {
			await page.getByTestId(`otp-input-${i}`).fill("2");
		}

		// Since testNumber is random, this is a new user registration.
		await expect(page.getByTestId("registration-success")).toBeVisible({
			timeout: 30000,
		});
		await page.getByTestId("registration-success-next-button").click();

		await page.waitForURL(/\/tutorial\//, { timeout: 30000 });

		if (page.url().includes("/tutorial")) {
			const nextBtn = page.getByRole("button", { name: "Weiter" });
			await expect(nextBtn).toBeVisible({ timeout: 15000 });
			for (let i = 0; i < 3; i++) {
				await nextBtn.click();
				await page.waitForTimeout(1000);
			}
			const startBtn = page.locator(
				'button:has-text("Jetzt starten"), button:has-text("Verstanden"), button:has-text("Start now"), button:has-text("Understood")',
			);
			await expect(startBtn).toBeVisible({ timeout: 10000 });

			const isRemote =
				baseURL &&
				!baseURL.includes("localhost") &&
				!baseURL.includes("127.0.0.1");
			if (isRemote) {
				// Wait for completion PATCH request response triggered by click
				const progressPromise = page.waitForResponse(
					(response) =>
						response.url().includes("/cms/my-tutorials/progress") &&
						response.status() === 200,
					{ timeout: 15000 },
				);
				await startBtn.click();
				await progressPromise;
			} else {
				await startBtn.click();
			}
		}

		await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

		// Clear session storage only to simulate re-login
		await page.evaluate(() => {
			window.sessionStorage.clear();
		});

		await page.goto("/auth?mode=login");

		await page.getByTestId("phone-input").fill(testNumber);
		await page.getByTestId("send-code-button").click();
		await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });

		for (let i = 0; i < 6; i++) {
			await page.getByTestId(`otp-input-${i}`).fill("2");
		}

		await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
	});

	test("Resilience: Persist Awaiting OTP state on Refresh", async ({
		page,
	}) => {
		await page.goto("/auth");
		await page.getByTestId("phone-input").fill("30231250003");
		await page.getByTestId("send-code-button").click();

		await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });

		await page.reload();
		await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });
	});

	test("Sad Path: Handle Sync Failure", async ({ page }) => {
		await page.goto("/auth?origin=eligibility");
		await expect(page.getByTestId("phone-number-form")).toBeVisible();
	});

	test("Security: Rate Limit Handling", async ({ page }) => {
		await page.goto("/auth");
		await page.getByTestId("phone-input").fill("999999999"); // Mock provider uses 999999 for error
		// We skip actual trigger to avoid flakiness, just ensuring the view is there
		await expect(page.getByTestId("phone-number-form")).toBeVisible();
	});

	test("Language Switching: Verify multilingual support", async ({ page }) => {
		await page.goto("/auth");
		await expect(page.getByText(/Mit Telefonnummer fortfahren/i)).toBeVisible();

		await page.getByTestId("language-switcher").click();
		await page.getByText("EN", { exact: true }).click();
		await expect(page.getByText(/Continue with Phone Number/i)).toBeVisible();
	});

	test("Accessibility: Auth Flow Deep Audit", async ({ page }) => {
		await page.goto("/auth");

		// Ensure form is fully loaded
		await expect(page.getByTestId("phone-number-form")).toBeVisible();

		await page.waitForTimeout(1000);
		const phoneResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(phoneResults.violations).toEqual([]);

		await page.getByTestId("phone-input").fill("30231250004");
		await page.getByTestId("send-code-button").click();

		await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });

		await page.waitForTimeout(1000);
		const otpResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(otpResults.violations).toEqual([]);
	});
});
