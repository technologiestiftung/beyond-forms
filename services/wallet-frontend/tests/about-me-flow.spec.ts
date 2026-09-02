import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
	ensureAuthenticatedSession,
	generateRandomTestPhoneNumber,
} from "./helpers/auth";

test.describe("About Me Progressive Wizard E2E & Accessibility Audits", () => {
	test.beforeEach(async ({ page, baseURL }) => {
		const randomPhone = generateRandomTestPhoneNumber();
		await ensureAuthenticatedSession(page, baseURL, randomPhone);

		// Go directly to About Me wizard
		await page.goto("/dashboard/application/about-me/questions");
		await expect(page.getByPlaceholder("Vorname")).toBeVisible({
			timeout: 15000,
		});
	});

	test.afterEach(async ({ page }) => {
		// Clear browser state to ensure test isolation
		await page.evaluate(() => {
			window.localStorage.clear();
			window.sessionStorage.clear();
		});
	});

	test("Should complete the entire About Me wizard flow (German citizen happy path) with zero a11y errors", async ({
		page,
	}) => {
		await page.goto("/dashboard/application/about-me/questions");

		// --- Page 1: Name ---
		await page.getByPlaceholder("Vorname").fill("Helmut");
		await page.getByPlaceholder("Nachname").fill("Klar");
		await page.getByRole("button", { name: "Weiter" }).click();

		// --- Page 2: Birthday & Place ---
		await expect(page.getByPlaceholder("Geburtsort")).toBeVisible({
			timeout: 15000,
		});
		await page.locator('input[type="date"]').fill("1959-01-20");
		await page.getByPlaceholder("Geburtsort").fill("Berlin");
		await page.getByRole("button", { name: "Weiter" }).click();

		// --- Page 3: Gender ---
		await expect(page.getByTestId("about-me-option-Male")).toBeVisible();
		await page.getByTestId("about-me-option-Male").click();

		// --- Page 4: Address ---
		await expect(
			page.getByPlaceholder("Straße, Hausnummer, PLZ, Stadt"),
		).toBeVisible();
		await page
			.getByPlaceholder("Straße, Hausnummer, PLZ, Stadt")
			.fill("Platz der Luftbrücke 4, 12101 Berlin");
		await page.getByRole("button", { name: "Weiter" }).click();

		// --- Page 6: Citizenship (Page 5 is skipped because we provided a fixed address) ---
		await expect(page.getByTestId("about-me-option-german")).toBeVisible();
		await page.getByTestId("about-me-option-german").click();

		// Run Accessibility Audit before submitting (includes color-contrast checking)
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);

		// Finish wizard
		await page.getByRole("button", { name: "Weiter" }).click();

		// Should redirect back to application overview
		await expect(page).toHaveURL(/\/dashboard\/application\/overview$/);
	});
});
