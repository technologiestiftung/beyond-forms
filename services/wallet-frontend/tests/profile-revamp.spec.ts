import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { isRemoteEnvironment } from "./helpers/auth";

test.describe("Automated E2E Integration & Accessibility Audits - Profile Revamp", () => {
	test.beforeEach(async ({ page, baseURL }) => {
		if (isRemoteEnvironment(baseURL)) {
			test.skip();
			return;
		}
		// Seed local session storage dev variables mocks to bypass auth firewall loops
		await page.addInitScript(() => {
			window.localStorage.setItem("VITE_USE_MOCKS", "true");
			window.sessionStorage.setItem(
				"beyond-forms-auth-session",
				JSON.stringify({
					state: {
						token: "mock-jwt-token",
						status: "SUCCESS_RETURNING",
						phoneNumber: "+4917622222222",
					},
					version: 1,
				}),
			);
			window.sessionStorage.setItem(
				"beyond-forms-tutorial-session",
				JSON.stringify({
					state: {
						tutorials: [
							{
								id: "8d8f41b2-c022-4a21-bc53-5d212eef32f1",
								slug: "app-guide",
								title: {
									de: "Wie funktioniert die Applikation?",
									en: "How does the application work?",
								},
								subtitle: {
									de: "Hier findest Du eine einfache Anleitung.",
									en: "Here you'll find a simple guide.",
								},
								progress: { status: "completed", current_step: null },
								steps: [
									{
										step_id: "step-1",
										image: "tutorial-app-guide-step-1",
										content: {
											de: { title: "Schritt-für-Schritt", text: "text" },
											en: { title: "Step-by-step", text: "text" },
										},
									},
								],
							},
						],
						initialized: true,
					},
					version: 1,
				}),
			);
		});
		await page.goto("/profile");
	});

	test("Profile Hub layout should have zero accessibility violations", async ({
		page,
	}) => {
		await expect(page.getByTestId("profile-name")).toContainText("Hallo");

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.disableRules(["color-contrast"])
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test("Personal Data Edit page should allow editing and trigger background saves", async ({
		page,
	}) => {
		// Navigate to the unified single page editor
		await page.getByTestId("section-personal").click();
		await expect(
			page.getByRole("heading", { name: "Persönliche Daten" }),
		).toBeVisible();

		// Wait for form to initialize with cached/default data
		const firstNameInput = page.getByTestId("field-firstName-input");
		await expect(firstNameInput).toHaveValue("Sandor");

		// Interact with fields and trigger blur auto-saving hook
		await firstNameInput.fill("Alexander");
		await firstNameInput.blur();

		// Verify saving status toast popup maps correctly
		await expect(page.locator("role=status")).toBeVisible();

		// Verify other sections are visible on the same page
		await expect(page.locator("label", { hasText: "Straße" })).toBeVisible();

		// Click Save and Close button
		await page.getByTestId("done-button").click();
		await expect(page).toHaveURL(/\/profile$/);

		// Wait for the cache update to reflect on the profile hub name display
		await expect(page.getByTestId("profile-name")).toContainText("Alexander");

		// Re-navigate to personal details page and verify value is persisted
		await page.getByTestId("section-personal").click();
		await expect(page.getByTestId("field-firstName-input")).toHaveValue(
			"Alexander",
		);

		// Click save to close again
		await page.getByTestId("done-button").click();
		await expect(page).toHaveURL(/\/profile$/);

		// Axe accessibility check inside the edit form
		await page.getByTestId("section-personal").click();
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.disableRules(["color-contrast", "button-name"])
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test("Settings layout should allow interaction with account deletion modal and be access-compliant", async ({
		page,
	}) => {
		// Navigate to settings single page
		await page.getByTestId("section-settings").click();
		await expect(
			page.getByRole("heading", { name: "Einstellungen" }),
		).toBeVisible();

		// Trigger delete account modal
		await page
			.getByRole("button", { name: "Mein Klaro Konto löschen" })
			.click();
		await expect(
			page.getByRole("heading", { name: "Konto unwiderruflich löschen?" }),
		).toBeVisible();

		// Cancel delete modal
		await page.getByRole("button", { name: "Abbrechen" }).click();
		await expect(
			page.getByRole("heading", { name: "Konto unwiderruflich löschen?" }),
		).not.toBeVisible();

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.disableRules(["color-contrast"])
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test("Documents Overview list dashboard should navigate to categories and allow document additions", async ({
		page,
	}) => {
		// Navigate to documents list dashboard component layout
		await page.getByTestId("section-documents").click();
		await expect(page.locator("text=Meine Dokumente")).toBeVisible();

		// Click one of the categories
		await page
			.locator("button", { hasText: "Identität und persönliche Dokumente" })
			.click();
		await expect(page.url()).toContain("/profile/documents/category/identity");

		// Strengthen assertions: verify category title and slot details are loaded
		await expect(
			page.getByRole("heading", {
				name: "Identität und persönliche Dokumente",
			}),
		).toBeVisible();
		await expect(page.getByTestId("slot-title-id_card")).toBeVisible();
		await expect(page.getByTestId("slot-title-registration")).toBeVisible();

		// Click "Dokument hinzufügen" inside the category view
		await page.locator("button", { hasText: "Dokument hinzufügen" }).click();
		await expect(page.url()).toContain("/profile/personal/upload");
	});
});
