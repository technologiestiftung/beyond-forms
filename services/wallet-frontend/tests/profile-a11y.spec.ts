import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
	ensureAuthenticatedSession,
	generateRandomTestPhoneNumber,
} from "./helpers/auth";

test.describe("Profile MVP - Sandor Accessibility Audit", () => {
	test.beforeEach(async ({ page, baseURL }) => {
		const randomPhone = generateRandomTestPhoneNumber();
		await ensureAuthenticatedSession(page, baseURL, randomPhone);
		await page.goto("/profile");
		await expect(page.getByTestId("profile-name")).toBeVisible();
	});

	test("Profile Hub should have no accessibility violations", async ({
		page,
	}) => {
		await expect(page.getByTestId("profile-name")).toBeVisible();
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test("Personal Data Tab should have no accessibility violations", async ({
		page,
	}) => {
		await page.getByTestId("section-personal").click();
		await expect(page.getByTestId("field-firstName-input")).toBeVisible();

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);
	});
});
