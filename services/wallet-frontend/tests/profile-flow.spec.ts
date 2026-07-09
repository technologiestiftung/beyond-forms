import { test, expect } from "@playwright/test";

test.describe("Profile MVP - Digital Wallet Flow Audit", () => {
	test.beforeEach(async ({ page, baseURL }) => {
		if (
			baseURL &&
			!baseURL.includes("localhost") &&
			!baseURL.includes("127.0.0.1")
		) {
			test.skip();
			return;
		}
		// Seed storage BEFORE page load so it's available on first render
		await page.addInitScript(() => {
			const mockProfile = {
				personalData: {
					firstName: "Max",
					lastName: "Mustermann",
					legalGender: "Male",
					dateOfBirth: "1950-01-01",
					placeOfBirth: "Berlin",
				},
			};

			const keys = [
				"beyond-forms-mock-profile-default",
				"beyond-forms-mock-profile-30231250005",
				"beyond-forms-mock-profile-+4930231250005",
			];

			keys.forEach((key) => {
				if (!window.localStorage.getItem(key)) {
					window.localStorage.setItem(key, JSON.stringify(mockProfile));
				}
			});

			window.localStorage.setItem("VITE_USE_MOCKS", "true");

			window.sessionStorage.setItem(
				"beyond-forms-auth-session",
				JSON.stringify({
					state: {
						token: "mock-token",
						status: "SUCCESS_RETURNING",
						phoneNumber: "+4930231250005",
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
		// Wait for initial load
		await expect(page.getByTestId("profile-name")).toBeVisible();
	});

	test("New User: Should see the profile details in the header", async ({
		page,
	}) => {
		await expect(page.getByTestId("profile-name")).toContainText("Hallo Max!");
	});

	test("Personal Data: Should complete the full edit and save cycle", async ({
		page,
	}) => {
		// Navigate through Hub and Choice
		await page.getByTestId("section-personal").click();

		// Verify initial values from seed (Max, Mustermann)
		const firstNameInput = page.getByTestId("field-firstName-input");
		await expect(firstNameInput).toHaveValue("Max");
		await expect(page.getByTestId("field-lastName-input")).toHaveValue(
			"Mustermann",
		);

		// Edit values
		await firstNameInput.fill("Sandor");
		await page.getByTestId("field-lastName-input").fill("Klaro");

		// Trigger auto-save via blur
		await page.getByTestId("field-lastName-input").blur();

		// Wait for "Saved" indicator or just proceed
		await expect(page.getByRole("status")).toBeVisible();
		await expect(page.getByText(/Saved|Gespeichert/i)).toBeVisible();

		// Finish
		await page.getByTestId("done-button").click();

		// Should navigate back to profile
		await expect(page).toHaveURL(/\/profile$/, { timeout: 10000 });

		// Verify persistence (reload and check)
		await page.reload();
		await expect(page.getByTestId("profile-name")).toContainText(
			"Hallo Sandor!",
			{ timeout: 10000 },
		);
	});

	test("Navigation Persistence: Should remember the last selected nav item", async ({
		page,
	}) => {
		await page
			.getByTestId("profile-link")
			.filter({ visible: true })
			.first()
			.click();
		await expect(page).toHaveURL(/\/profile/);

		const storageState = await page.evaluate(() =>
			JSON.parse(localStorage.getItem("beyond-forms-preferences") || "{}"),
		);
		expect(storageState.state.lastSelectedNav).toBe("/profile");
	});
});
