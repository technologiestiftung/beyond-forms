import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
	ensureAuthenticatedSession,
	generateRandomTestPhoneNumber,
} from "./helpers/auth";

test.describe("Chat Accessibility Audit - WCAG 2.1 AA", () => {
	test.beforeEach(async ({ page, baseURL }) => {
		test.setTimeout(120000);

		// Authenticate session
		const phoneNumber = generateRandomTestPhoneNumber();
		await ensureAuthenticatedSession(page, baseURL, phoneNumber);
		await page.goto("/dashboard");
	});

	test("Chat sheet and chat input form should have no accessibility violations", async ({
		page,
	}) => {
		// Open Chat Bottom Sheet
		const chatToggle = page
			.getByTestId("nav-chat-button")
			.or(page.getByTestId("nav-chat-sidebar"))
			.or(page.getByRole("button", { name: /Chat/i }))
			.filter({ visible: true })
			.first();
		await chatToggle.click();
		await expect(page.locator('[role="dialog"]')).toBeVisible();

		// Wait for chat input to be visible and interactive
		const chatInput = page.getByTestId("chat-input");
		await expect(chatInput).toBeVisible();

		// Run Axe audit on the chat container specifically
		const results = await new AxeBuilder({ page })
			.include('[role="dialog"]')
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		expect(results.violations).toEqual([]);
	});
});
