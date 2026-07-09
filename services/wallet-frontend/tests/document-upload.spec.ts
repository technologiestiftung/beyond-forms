/* global Buffer */
import { test, expect, type Page } from "@playwright/test";

async function navigateAndBypassTutorial(page: Page, targetUrl: string) {
	await page.goto(targetUrl);
	await page.waitForTimeout(1500); // Allow React asynchronous redirects and state hydration to settle completely
	while (
		await page
			.getByRole("button", { name: /Weiter|Jetzt starten|Verstanden/i })
			.isVisible()
	) {
		await page
			.getByRole("button", { name: /Weiter|Jetzt starten|Verstanden/i })
			.click();
		await page.waitForTimeout(1000);
	}
}

test.describe("Document Upload and Mobile Camera Capture Audit", () => {
	test.beforeEach(async ({ page, baseURL }) => {
		if (
			baseURL &&
			!baseURL.includes("localhost") &&
			!baseURL.includes("127.0.0.1")
		) {
			test.skip();
			return;
		}
		await page.addInitScript(() => {
			window.localStorage.setItem("VITE_USE_MOCKS", "true");
			window.localStorage.setItem(
				"beyond-forms-preferences",
				JSON.stringify({
					state: { language: "de" },
					version: 1,
				}),
			);

			const mockProfile = {
				personalData: {
					firstName: "Helmut",
					lastName: "Klar",
					legalGender: "Male",
					dateOfBirth: "1959-01-20",
					placeOfBirth: "Berlin",
				},
			};

			const keys = [
				"beyond-forms-mock-profile-default",
				"beyond-forms-mock-profile-30231250005",
				"beyond-forms-mock-profile-+4930231250005",
			];

			keys.forEach((key) => {
				window.localStorage.setItem(key, JSON.stringify(mockProfile));
			});

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
								slug: "tutorial-app-guide",
								progress: {
									status: "completed",
								},
							},
						],
						initialized: true,
					},
					version: 1,
				}),
			);
		});
	});

	test("Origin Wizard: Active CTA and dedicated mobile camera interface with return redirection", async ({
		page,
	}) => {
		test.setTimeout(120000);

		// Step 1: Navigate directly to camera upload in wizard origin
		await navigateAndBypassTutorial(
			page,
			"/profile/personal/upload?origin=wizard&category=income_assets&mode=camera",
		);

		// Step 3: Verify dedicated mobile camera interface (Drag & Drop text absent)
		await expect(page.getByText(/Kamera öffnen/i)).toBeVisible();
		await expect(
			page.getByText(/Klicken oder Datei hierher ziehen/i),
		).not.toBeVisible();

		// Step 4: Verify Active execution CTA (Not disabled)
		const dropzone = page.getByTestId("dropzone-select-trigger");
		await expect(dropzone).not.toBeDisabled();
		await expect(dropzone).toContainText(/Kamera öffnen/i);

		// Step 5: Attach mock photo file
		// @ts-expect-error Node Buffer is available in Playwright execution context
		const mockImage = Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
			"base64",
		);
		await page.locator('input[type="file"]').first().setInputFiles({
			name: "document_scan.png",
			mimeType: "image/png",
			buffer: mockImage,
		});

		// Step 6: Verify Staged CTA and Process
		await expect(page.getByAltText("Seite 1")).toBeVisible();
		const confirmBtn = page.getByTestId("upload-confirm-button");
		await expect(confirmBtn).toContainText(/Foto verwenden & verarbeiten/i);
		await confirmBtn.click();

		// Step 7: Verify automatic context-aware origin redirection back to Wizard Overview
		await page.waitForURL(/\/dashboard\/application\/overview/, {
			timeout: 20000,
		});

		// Step 8: Verify the updated banner is visible on the overview dashboard
		await expect(
			page.getByText(
				/Dein Antrag wurde basierend auf deinem Dokument "stitched_mock_document_scan.png" aktualisiert./i,
			),
		).toBeVisible();
	});

	test("Origin Hub: Active CTA and file upload with return redirection", async ({
		page,
	}) => {
		test.setTimeout(120000);

		// Step 1: Start from Dashboard, bypass tutorial, and navigate to Meine Dokumente Hub via Profile
		await navigateAndBypassTutorial(page, "/dashboard");
		await expect(
			page.getByRole("heading", { level: 1, name: /Hallo Helmut/i }),
		).toBeVisible({
			timeout: 15000,
		});

		await page.getByRole("link", { name: /Profil/i }).click();
		await expect(
			page.getByRole("heading", { level: 2, name: /Meine Dokumente/i }),
		).toBeVisible();

		await page.getByRole("button", { name: /Meine Dokumente/i }).click();
		await expect(
			page.getByRole("heading", { level: 1, name: /Meine Dokumente/i }),
		).toBeVisible({
			timeout: 15000,
		});

		// Step 2: Navigate to upload for identity category via React Router links
		await page
			.getByRole("button", {
				name: /Identität und persönliche Dokumente|Identity/i,
			})
			.click();
		await page.getByRole("button", { name: /Dokument hinzufügen/i }).click();

		// Step 3: Verify Active upload CTA
		const dropzone = page.getByTestId("dropzone-select-trigger");
		await expect(dropzone).toBeVisible();
		await expect(dropzone).not.toBeDisabled();
		await expect(dropzone).toContainText(/Klicken oder Datei hierher ziehen/i);

		// Step 4: Attach mock PDF file
		// @ts-expect-error Node Buffer is available in Playwright execution context
		const mockPdf = Buffer.from(
			"JVBERi0xLjQKJcOkw7zDtsOfCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nPj4KZW5kb2JqCnhyZWYK",
			"base64",
		);
		await page.locator('input[type="file"]').first().setInputFiles({
			name: "ausweis.pdf",
			mimeType: "application/pdf",
			buffer: mockPdf,
		});

		// Step 5: Verify Staged CTA and Process
		await expect(page.getByText("PDF", { exact: true })).toBeVisible();
		const confirmBtn = page.getByTestId("upload-confirm-button");
		await expect(confirmBtn).toContainText(/Dokument verarbeiten/i);
		await confirmBtn.click();

		// Step 6: On Document Review screen, confirm extracted fields and progress through Success milestone
		await expect(page.getByText(/Daten prüfen/i)).toBeVisible({
			timeout: 20000,
		});
		await page.getByRole("button", { name: /Bestätigen/i }).click();

		const successHeading = page.getByRole("heading", {
			name: /Daten übernommen/i,
		});
		await successHeading.waitFor({ state: "visible", timeout: 10000 });
		await page.getByRole("button", { name: /Weiter/i }).click();

		// Step 7: Verify automatic context-aware origin redirection back to Hub Category
		await page.waitForURL(/\/profile\/documents\/category\/identity/, {
			timeout: 20000,
		});
	});
});
