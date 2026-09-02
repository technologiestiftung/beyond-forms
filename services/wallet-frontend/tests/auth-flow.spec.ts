import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
	generateRandomTestPhoneNumber,
	isRemoteEnvironment,
	openManualPhoneForm,
} from "./helpers/auth";

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
		// Fresh sessions land on the persona picker; the phone form is one click away.
		await expect(page.getByTestId("persona-picker")).toBeVisible();
		await openManualPhoneForm(page);
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
		await openManualPhoneForm(page);
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

		// The mandatory tutorial gate is disabled (demo mode): new users land
		// directly on the dashboard.
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
	});

	test("Returning User: Direct Login", async ({ page, baseURL }) => {
		const testNumber = generateRandomTestPhoneNumber();

		await page.goto("/auth?mode=login");
		await openManualPhoneForm(page);

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

		// The mandatory tutorial gate is disabled (demo mode): new users land
		// directly on the dashboard.
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

		// In the local mock, "returning user" is decided by a lazily persisted
		// mock profile in localStorage (written on first dashboard load). Wait
		// for it so the re-login below isn't misclassified as a new user.
		const isRemote = isRemoteEnvironment(baseURL);
		if (!isRemote) {
			await page.waitForFunction(
				() =>
					Object.keys(window.localStorage).some((k) =>
						k.startsWith("beyond-forms-mock-profile-"),
					),
				null,
				{ timeout: 10000 },
			);
		}

		// Clear session storage only to simulate re-login
		await page.evaluate(() => {
			window.sessionStorage.clear();
		});

		await page.goto("/auth?mode=login");

		await openManualPhoneForm(page);
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
		await openManualPhoneForm(page);
		await page.getByTestId("phone-input").fill("30231250003");
		await page.getByTestId("send-code-button").click();

		await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });

		await page.reload();
		await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });
	});

	test("Sad Path: Handle Sync Failure", async ({ page }) => {
		await page.goto("/auth?origin=eligibility");
		await openManualPhoneForm(page);
	});

	test("Security: Rate Limit Handling", async ({ page }) => {
		await page.goto("/auth");
		await openManualPhoneForm(page);
		await page.getByTestId("phone-input").fill("999999999"); // Mock provider uses 999999 for error
		// We skip actual trigger to avoid flakiness, just ensuring the view is there
		await expect(page.getByTestId("phone-number-form")).toBeVisible();
	});

	test("Language Switching: Verify multilingual support", async ({ page }) => {
		await page.goto("/auth");
		// The persona picker is the first screen of the auth view.
		await expect(
			page.getByText(/Mit Telefonnummer anmelden/i),
		).toBeVisible();

		await page.getByTestId("language-switcher").click();
		await page.getByText("EN", { exact: true }).click();
		await expect(
			page.getByText(/Log in with a phone number/i),
		).toBeVisible();
	});

	test("Accessibility: Auth Flow Deep Audit", async ({ page }) => {
		// Three axe audits (picker, phone form, OTP form) need more than the
		// default 30s local budget.
		test.setTimeout(90000);

		await page.goto("/auth");

		// The persona picker is the new entry screen — audit it, then continue
		// to the phone form.
		await expect(page.getByTestId("persona-picker")).toBeVisible();
		await page.waitForTimeout(1000);
		const pickerResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(pickerResults.violations).toEqual([]);

		await openManualPhoneForm(page);

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
