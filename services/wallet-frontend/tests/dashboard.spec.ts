import { test, expect } from "@playwright/test";
import { isRemoteEnvironment } from "./helpers/auth";

test.describe("Dashboard View Audit", () => {
	test.beforeEach(async ({ page, baseURL }) => {
		if (isRemoteEnvironment(baseURL)) {
			test.skip();
			return;
		}
		// Seed storage for a returning user (Helmut)
		await page.addInitScript(() => {
			window.localStorage.setItem("VITE_USE_MOCKS", "true");
			window.localStorage.setItem(
				"beyond-forms-preferences",
				JSON.stringify({
					state: { language: "en" },
					version: 1,
				}),
			);
			const mockProfile = {
				personalData: {
					firstName: "Helmut",
					lastName: "Klar",
					legalGender: "Female",
					dateOfBirth: "1952-06-18",
					placeOfBirth: "Rome",
				},
			};
			window.localStorage.setItem(
				"beyond-forms-mock-profile-default",
				JSON.stringify(mockProfile),
			);
			window.localStorage.setItem(
				"beyond-forms-mock-profile-+4930231250005",
				JSON.stringify(mockProfile),
			);
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
								progress: { status: "completed", current_step: null },
							},
						],
						initialized: true,
					},
					version: 1,
				}),
			);
		});

		await page.goto("/dashboard");
	});

	test("Returning User: Should see personalized dashboard", async ({
		page,
	}) => {
		await expect(
			page.getByRole("heading", { level: 1, name: /hello helmut/i }),
		).toBeVisible();
		await expect(page.getByText(/welcome to klaro/i)).toBeVisible();
		await expect(page.getByText(/basic security/i)).toBeVisible();
		await expect(
			page.getByText(
				/Start your application. Klaro shows you step by step what is important./i,
			),
		).toBeVisible();
	});

	test("Navigation: Should navigate to application overview from application card", async ({
		page,
	}) => {
		await page.getByTestId("lets-go-button").click();
		await expect(page).toHaveURL(/\/dashboard\/application\/overview/);
	});
});

test.describe("Dashboard New User Audit", () => {
	test.beforeEach(async ({ page, baseURL }) => {
		if (isRemoteEnvironment(baseURL)) {
			test.skip();
			return;
		}
		// Seed storage for a new user (Malte)
		await page.addInitScript(() => {
			window.localStorage.setItem("VITE_USE_MOCKS", "true");
			window.localStorage.setItem(
				"beyond-forms-preferences",
				JSON.stringify({
					state: { language: "en" },
					version: 1,
				}),
			);
			const mockProfile = {
				personalData: {
					firstName: "Malte",
					lastName: "",
					legalGender: "Diverse",
					dateOfBirth: "",
					placeOfBirth: "",
				},
			};
			window.localStorage.setItem(
				"beyond-forms-mock-profile-default",
				JSON.stringify(mockProfile),
			);
			window.localStorage.setItem(
				"beyond-forms-mock-profile-+4930231250005",
				JSON.stringify(mockProfile),
			);
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
								progress: { status: "completed", current_step: null },
							},
						],
						initialized: true,
					},
					version: 1,
				}),
			);
		});

		await page.goto("/dashboard");
	});

	test("New User: Should see recommendation dashboard", async ({ page }) => {
		await expect(
			page.getByRole("heading", { level: 1, name: /hello malte/i }),
		).toBeVisible();
		await expect(page.getByText(/basic security/i)).toBeVisible();
		await expect(
			page.getByText(
				/Start your application. Klaro shows you step by step what is important./i,
			),
		).toBeVisible();
	});
});
