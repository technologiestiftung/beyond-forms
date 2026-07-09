import { test, expect } from "@playwright/test";
import {
	generateRandomTestPhoneNumber,
	registerAuthBypassRoute,
} from "./helpers/auth";

test.describe("Mandatory Onboarding Technical Tutorial E2E Gate & Session purification", () => {
	test.beforeEach(async ({ page, context }) => {
		await registerAuthBypassRoute(page);

		await page.goto("/");
		await context.clearCookies();
		await page.evaluate(() => {
			window.localStorage.clear();
			window.sessionStorage.clear();
		});
	});

	test("New Citizen Registration: Block Dashboard Access and Force Onboarding Technical Guide", async ({
		page,
	}) => {
		// 1. Onboard through eligibility check
		await page.goto("/");
		await page.getByTestId("start-button").click();

		await page.getByTestId("option-german").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-yes").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("dob-date-input").fill("1959-01-20");
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-old_age").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-not_sufficient").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("option-no").click();
		await page.getByTestId("next-button").click();

		await page.getByTestId("outcome-cta").click();
		await expect(page).toHaveURL(/\/auth\?origin=eligibility/);

		// 2. Trigger Authentication success for a new user (phone ending in 1)
		const newCitizenPhone = generateRandomTestPhoneNumber();
		await page.getByTestId("phone-input").fill(newCitizenPhone);
		await page.getByTestId("send-code-button").click();
		await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });

		for (let i = 0; i < 6; i++) {
			await page.getByTestId(`otp-input-${i}`).fill("1");
		}

		await expect(page.getByTestId("registration-success")).toBeVisible({
			timeout: 30000,
		});
		await page.getByTestId("registration-success-next-button").click();

		// 3. Verify strict redirection intercept to the technical guide page
		await expect(page).toHaveURL(
			/\/tutorial\/wie-funktioniert-die-applikation/,
		);

		// 4. Verify Visual Compliance Controls (Close button is suppressed)
		await expect(
			page.locator('button[aria-label="Close guide"]'),
		).not.toBeVisible();
		await expect(
			page.locator('button[aria-label="Anleitung schließen"]'),
		).not.toBeVisible();

		// 5. Step 0 Back button is suppressed
		await expect(page.getByTestId("topbar-back")).not.toBeVisible();

		// 6. Progress through technical onboarding step pages
		// Step 1 -> 2
		await page.getByText("Weiter").click();
		await expect(page.getByTestId("topbar-back")).toBeVisible(); // Back button now visible on step > 0

		// Step 2 -> 3
		await page.getByText("Weiter").click();

		// Step 3 -> 4
		await page.getByText("Weiter").click();

		// Step 4 (Last step) -> Optimistic dashboard redirection
		const lastStepButton = page.locator(
			'button:has-text("Jetzt starten"), button:has-text("Verstanden"), button:has-text("Back to application")',
		);
		await expect(lastStepButton).toBeVisible();
		await lastStepButton.click();

		// Assert landing on dashboard successfully
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(
			page.getByText(/welcome to klaro|willkommen bei klaro/i).first(),
		).toBeVisible();
	});

	test("Session Isolation: Logging out purifies session and blocks next session's bypass", async ({
		page,
	}) => {
		// 1. Authenticate Citizen A (returning user, phone ending in 2)
		await page.goto("/auth");
		const citizenAPhone = generateRandomTestPhoneNumber();
		await page.getByTestId("phone-input").fill(citizenAPhone);
		await page.getByTestId("send-code-button").click();
		await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });
		for (let i = 0; i < 6; i++) {
			await page.getByTestId(`otp-input-${i}`).fill("2");
		}

		const welcomeBtnA = page.getByTestId("registration-success-next-button");
		await expect(welcomeBtnA).toBeVisible({ timeout: 30000 });
		await welcomeBtnA.click();

		await expect(page).toHaveURL(
			/\/tutorial\/wie-funktioniert-die-applikation/,
		);

		// 2. Citizen A completes the tutorial steps to get dashboard access
		await page.getByText("Weiter").click();
		await page.getByText("Weiter").click();
		await page.getByText("Weiter").click();
		await page
			.locator(
				'button:has-text("Jetzt starten"), button:has-text("Verstanden"), button:has-text("Back to application")',
			)
			.click();
		await expect(page).toHaveURL(/\/dashboard/);

		// 3. Navigate to profile, then settings, then trigger logout
		await page
			.getByTestId("profile-link")
			.filter({ visible: true })
			.first()
			.click();
		await expect(page).toHaveURL(/\/profile$/);
		await page.getByTestId("section-settings").click();
		await expect(page).toHaveURL(/\/profile\/settings$/);

		await page
			.locator(
				'button:has-text("ausloggen"), button:has-text("Abmelden"), button:has-text("Logout")',
			)
			.click();
		await expect(page).toHaveURL(/\/$/); // Land on home route "/" after page reload

		// 4. Authenticate Citizen B (returning user in same browser context, phone ending in 3)
		await page.goto("/auth");
		const citizenBPhone = generateRandomTestPhoneNumber();
		await page.getByTestId("phone-input").fill(citizenBPhone);
		await page.getByTestId("send-code-button").click();
		await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });
		for (let i = 0; i < 6; i++) {
			await page.getByTestId(`otp-input-${i}`).fill("3");
		}

		const welcomeBtnB = page.getByTestId("registration-success-next-button");
		await expect(welcomeBtnB).toBeVisible({ timeout: 30000 });
		await welcomeBtnB.click();

		// 5. Assert that Citizen B is intercepted and blocked (tutorial must render and NOT bypass)
		await expect(page).toHaveURL(
			/\/tutorial\/wie-funktioniert-die-applikation/,
		);
	});
});
