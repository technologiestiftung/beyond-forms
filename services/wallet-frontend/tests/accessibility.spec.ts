import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
	ensureAuthenticatedSession,
	generateRandomTestPhoneNumber,
} from "./helpers/auth";

test.describe("Accessibility Audits - Profile Workspace", () => {
	test.beforeEach(async ({ page, baseURL }) => {
		const randomPhone = generateRandomTestPhoneNumber();
		await ensureAuthenticatedSession(page, baseURL, randomPhone);
		await page.goto("/profile");
	});

	test("Profile Workspace should have no accessibility violations", async ({
		page,
	}) => {
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test("Persona Tab should have no accessibility violations with errors", async ({
		page,
	}) => {
		// Navigate to Personal Data Edit
		await page.getByTestId("section-personal").click();

		// Trigger validation error by entering an invalid ZIP code length
		const zipInput = page.getByTestId("field-zipCode-input");
		await zipInput.fill("123456789012345");
		await zipInput.blur();

		// Wait for zipCode error message to be fully visible
		await expect(page.getByTestId("field-zipCode-error")).toBeVisible();

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);
	});
});
