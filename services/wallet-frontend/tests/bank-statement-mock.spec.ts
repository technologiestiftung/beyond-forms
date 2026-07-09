import { test, expect, type Page } from "@playwright/test";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Buffer: any;
import { getMockProfileStorageKey } from "../src/utils/profile";

async function navigateAndBypassTutorial(page: Page, targetUrl: string) {
	await page.goto(targetUrl);
	await page.waitForTimeout(1500);
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

test.describe("Bank Statement Mock Auto-Verification", () => {
	test.beforeEach(async ({ page, baseURL }) => {
		if (
			baseURL &&
			!baseURL.includes("localhost") &&
			!baseURL.includes("127.0.0.1")
		) {
			test.skip();
			return;
		}
		const keys = [
			getMockProfileStorageKey("default"),
			getMockProfileStorageKey("30231250005"),
			getMockProfileStorageKey("+4930231250005"),
		];

		await page.addInitScript((mockKeys) => {
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
				documents: [],
			};

			mockKeys.forEach((key) => {
				if (!window.localStorage.getItem(key)) {
					window.localStorage.setItem(key, JSON.stringify(mockProfile));
				}
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
		}, keys);
	});

	test("should auto-verify bank statement and extract bank details, income, and address", async ({
		page,
	}) => {
		test.setTimeout(60000);

		// Go to Documents page via Dashboard and Profil navigation links
		await navigateAndBypassTutorial(page, "/dashboard");
		await expect(
			page.getByRole("heading", { level: 1, name: /Hallo Helmut/i }),
		).toBeVisible({ timeout: 15000 });

		await page.getByRole("link", { name: /Profil/i }).click();
		await expect(
			page.getByRole("heading", { level: 2, name: /Meine Dokumente/i }),
		).toBeVisible({ timeout: 15000 });

		await page.getByRole("button", { name: /Meine Dokumente/i }).click();
		await expect(
			page.getByRole("heading", { level: 1, name: /Meine Dokumente/i }),
		).toBeVisible({ timeout: 15000 });

		// Click Income category
		await page
			.getByRole("button", { name: /Einkommen|Income/i })
			.first()
			.click();
		await page
			.getByRole("button", { name: /Dokument hinzufügen|Add document/i })
			.first()
			.click();

		// Attach mock PDF file representing bank statement
		const mockPdf = Buffer.from("PDF");
		await page.locator('input[type="file"]').first().setInputFiles({
			name: "Bank_Statement_Helmut_Klar.pdf",
			mimeType: "application/pdf",
			buffer: mockPdf,
		});

		// Trigger process
		const uploadBtn = page.getByTestId("upload-confirm-button");
		await expect(uploadBtn).toContainText(/Dokument verarbeiten/i);
		await uploadBtn.click();

		// On Document Review screen, confirm fields extracted
		await expect(page.getByText(/Daten prüfen/i)).toBeVisible({
			timeout: 20000,
		});
		await page.getByRole("button", { name: /Bestätigen/i }).click();

		// Await success screen and proceed
		await expect(
			page.getByRole("heading", { name: /Daten übernommen/i }),
		).toBeVisible({ timeout: 10000 });
		await page.getByRole("button", { name: "Weiter", exact: true }).click();

		// Verify redirection back to /profile/documents/category/income
		await page.waitForURL(/\/profile\/documents\/category\/income/, {
			timeout: 20000,
		});

		// Go to profile edit/view to verify that personal data and address are updated
		await page.getByRole("link", { name: /Profil/i }).click();
		await expect(page.getByTestId("profile-name")).toContainText("Helmut");

		await page.getByTestId("section-personal").click();
		await expect(page.getByTestId("field-firstName-input")).toHaveValue(
			"Helmut",
		);
		await expect(page.getByTestId("field-lastName-input")).toHaveValue("Klar");
		await expect(page.getByTestId("field-street-input")).toHaveValue(
			"Platz der Luftbrücke",
		);
		await expect(page.getByTestId("field-houseNumber-input")).toHaveValue("4");
		await expect(page.getByTestId("field-zipCode-input")).toHaveValue("12101");
		await expect(page.getByTestId("field-city-select")).toHaveValue("Berlin");
	});

	test("should auto-verify bank statement and pre-populate the wizard questionnaire", async ({
		page,
	}) => {
		test.setTimeout(60000);

		// Go to Application Income/Assets wizard page directly and check it is empty
		await page.goto("/dashboard/application/income-assets/questions");
		await expect(page.getByTestId("option-card-ja")).toBeVisible({
			timeout: 15000,
		});

		// Click through to Page 3 (Pension) to check amount is empty
		await page.getByRole("button", { name: "Weiter", exact: true }).click(); // Page 1 -> Page 2
		await expect(
			page.getByRole("heading", { name: /Sozialleistungen erhalten/i }),
		).toBeVisible();
		await page.getByRole("button", { name: "Weiter", exact: true }).click(); // Page 2 -> Page 3
		await expect(
			page.getByRole("heading", { name: /Beziehst Du eine Rente/i }),
		).toBeVisible();
		await expect(page.locator("#pension-amount")).toHaveCount(0); // not visible because no pension selected

		// Go to Documents page via Dashboard
		await page.goto("/profile/documents");
		await expect(
			page.getByRole("heading", { level: 1, name: /Meine Dokumente/i }),
		).toBeVisible({ timeout: 15000 });

		// Click Income category and upload bank statement
		await page
			.getByRole("button", { name: /Einkommen|Income/i })
			.first()
			.click();
		await page
			.getByRole("button", { name: /Dokument hinzufügen|Add document/i })
			.first()
			.click();

		const mockPdf = Buffer.from("PDF");
		await page.locator('input[type="file"]').first().setInputFiles({
			name: "Bank_Statement_Helmut_Klar.pdf",
			mimeType: "application/pdf",
			buffer: mockPdf,
		});

		// Trigger process
		const uploadBtn = page.getByTestId("upload-confirm-button");
		await uploadBtn.click();

		// Confirm extracted fields
		await expect(page.getByText(/Daten prüfen/i)).toBeVisible({
			timeout: 20000,
		});
		await page.getByRole("button", { name: /Bestätigen/i }).click();

		// Success screen
		await expect(
			page.getByRole("heading", { name: /Daten übernommen/i }),
		).toBeVisible({ timeout: 10000 });
		await page.getByRole("button", { name: "Weiter", exact: true }).click();

		// Verify redirection back to /profile/documents/category/income
		await page.waitForURL(/\/profile\/documents\/category\/income/, {
			timeout: 20000,
		});

		// Navigate back to the Income/Assets wizard flow
		await page.goto("/dashboard/application/income-assets/questions");
		await expect(page.getByTestId("option-card-ja")).toBeVisible({
			timeout: 15000,
		});

		// Step forward to Page 3 (Pension)
		await page.getByRole("button", { name: "Weiter", exact: true }).click(); // Page 1 -> Page 2
		await expect(
			page.getByRole("heading", { name: /Sozialleistungen erhalten/i }),
		).toBeVisible();
		await page.getByRole("button", { name: "Weiter", exact: true }).click(); // Page 2 -> Page 3
		await expect(
			page.getByRole("heading", { name: /Beziehst Du eine Rente/i }),
		).toBeVisible();

		// Assert pension amount is pre-filled with 650
		await expect(page.locator("#pension-amount")).toHaveValue("650");

		// Go directly to Step 7 (Bank details) by navigating
		await page.getByRole("button", { name: "Weiter", exact: true }).click(); // Page 3 -> Page 4
		await expect(
			page.getByRole("heading", { name: /Erwerbssituation/i }),
		).toBeVisible();

		await page.getByTestId("option-card-nichts_davon").click();
		await page.getByRole("button", { name: "Weiter", exact: true }).click(); // Page 4 -> Page 5
		await expect(
			page.getByRole("heading", { name: /weitere regelmäßige Einnahmen/i }),
		).toBeVisible();

		await page.getByRole("button", { name: "Weiter", exact: true }).click(); // Page 5 -> Page 6
		await expect(
			page.getByRole("heading", { name: /einmalige Zahlung/i }),
		).toBeVisible();

		await page.getByRole("button", { name: "Weiter", exact: true }).click(); // Page 6 -> Page 7
		await expect(
			page.getByRole("heading", { name: /Bankverbindung/i }),
		).toBeVisible();

		// Assert bank details are pre-filled
		await expect(page.locator("#account-holder")).toHaveValue("Helmut Klar");
		await expect(page.locator("#bank-name")).toHaveValue(
			"Sparkasse Musterstadt",
		);
		await expect(page.locator("#iban")).toHaveValue("DE65940594210000123456");
	});
});
