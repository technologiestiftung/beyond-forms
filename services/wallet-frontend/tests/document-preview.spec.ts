/* global process */
import { test, expect } from "@playwright/test";
import * as path from "path";
import { fileURLToPath } from "url";
import {
	generateRandomTestPhoneNumber,
	openManualPhoneForm,
	registerAuthBypassRoute,
} from "./helpers/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MVP_DOCS_DIR =
	process.env.MVP_DOCS_DIR || path.join(__dirname, "fixtures");
const MVP_SCREENSHOTS_DIR =
	process.env.MVP_SCREENSHOTS_DIR || "/tmp/mvp-screenshots";

// Real document upload flow. Against the docker-compose e2e stack, the OCR
// extraction is short-circuited server-side (MOCK_LLM_RESPONSES=true) so
// this runs without real Gemini credentials; against staging/prod it still
// exercises the real extraction pipeline.
test.describe("MVP Citizen Document Preview & E2E Visual Audit", () => {
	// Relax Timeout for heavy OCR uploads
	test.setTimeout(240000);

	test.beforeEach(async ({ page, context }) => {
		await context.clearCookies();
		await page.goto("/");
		await page.evaluate(() => {
			window.sessionStorage.clear();
			window.localStorage.clear();
		});
		await page.reload();
	});

	test("executes login, document upload, verification, and visual preview overlay audit", async ({
		page,
	}) => {
		// 1. E-Check & Login onboarding
		await page.goto("/");
		const startBtn = page.getByTestId("start-button");
		await expect(startBtn).toBeVisible({ timeout: 15000 });
		await startBtn.click();

		const firstOption = page
			.getByTestId("option-german")
			.or(page.getByTestId("option-yes"))
			.first();
		await expect(firstOption).toBeVisible({ timeout: 15000 });

		const optionGerman = page.getByTestId("option-german");
		if ((await optionGerman.count()) > 0) {
			await optionGerman.click();
		} else {
			await page.getByTestId("option-yes").click();
		}
		await page.getByTestId("next-button").click();

		// E-Check Question 2: Lives in Germany? (Yes)
		await page.getByTestId("option-yes").click();
		await page.getByTestId("next-button").click();

		// E-Check Question 3: Date of birth (Helmut: 20.01.1959 → ISO 1959-01-20)
		await page.getByTestId("dob-date-input").fill("1959-01-20");
		await page.getByTestId("next-button").click();

		// E-Check Question 4: Pension status (Helmut Old-age)
		await page.getByTestId("option-old_age").click();
		await page.getByTestId("next-button").click();

		// E-Check Question 5: Income assessment (Not sufficient)
		await page.getByTestId("option-not_sufficient").click();
		await page.getByTestId("next-button").click();

		// E-Check Question 6: Assets above €10,000? (No)
		await page.getByTestId("option-no").click();
		await page.getByTestId("next-button").click();

		await expect(page).toHaveURL(/\/eligibility-check\/result/);
		await page.getByTestId("outcome-cta").click();
		await expect(page).toHaveURL(/\/auth/);

		const loginLink = page.getByText(
			/Ich habe bereits ein Konto|I already have an account/i,
		);
		if (await loginLink.isVisible()) {
			await loginLink.click();
		}

		await registerAuthBypassRoute(page);

		const phoneNumber = generateRandomTestPhoneNumber();
		await openManualPhoneForm(page);
		await page.getByTestId("phone-input").fill(phoneNumber);
		await page.getByTestId("send-code-button").click();

		for (let i = 0; i < 6; i++) {
			await page.getByTestId(`otp-input-${i}`).fill("1");
		}

		// 1. Click "Weiter" on welcome screen
		const welcomeBtn = page.getByTestId("registration-success-next-button");
		await expect(welcomeBtn).toBeVisible({ timeout: 15000 });
		await welcomeBtn.click();

		// 2. The mandatory tutorial gate is disabled (demo mode): new users
		// land directly on the dashboard.
		await page.waitForURL(/\/dashboard/, { timeout: 20000 });

		// 2. Go to Profile Documents ("Meine Dokumente")
		const profileLink = page
			.getByTestId("profile-link")
			.or(page.getByRole("link", { name: /Profil/i }))
			.filter({ visible: true })
			.first();
		await profileLink.click();
		await page.waitForURL(/\/profile/);

		const myDocsCard = page
			.getByTestId("section-documents")
			.or(
				page.getByRole("button", {
					name: /Meine Dokumente|My documents|Dokumente/i,
				}),
			)
			.first();
		await myDocsCard.click();
		await page.waitForURL(/\/profile\/documents/);

		// 3. Upload a PDF Document (Bank Statement)
		await page
			.getByRole("button", {
				name: /Identität und persönliche Dokumente|Identity and personal documents/i,
			})
			.click();
		const idCardSlotBtn = page.getByTestId("slot-btn-id_card");
		await expect(idCardSlotBtn).toBeVisible({ timeout: 5000 });
		await idCardSlotBtn.click();

		await expect(page).toHaveURL(/\/profile\/personal\/upload/);

		const idCardPdfPath = path.join(
			MVP_DOCS_DIR,
			"Bank_Statement_Helmut_Klar.pdf",
		);
		await page.setInputFiles("input[type='file']", idCardPdfPath);

		await page.getByTestId("upload-confirm-button").click();
		await page.waitForURL(/\/profile\/documents/, { timeout: 90000 });

		// Wait for redirect to settle or documents list to load
		await page.waitForTimeout(2000);

		// Trigger Review if not already on the review page
		if (!page.url().includes("/review")) {
			const reviewBtn = page
				.getByRole("button", { name: /Prüfen|Review/i })
				.first();
			await expect(reviewBtn).toBeVisible({ timeout: 90000 });
			await reviewBtn.click();
		}

		await expect(page).toHaveURL(/\/profile\/documents\/.*\/review/, {
			timeout: 15000,
		});

		// Confirm Fields
		await page.getByTestId("confirm-button").click();
		await expect(page).toHaveURL(/\/profile\/documents\/.*\/success/);
		await page
			.getByRole("button", {
				name: /Weiter|Continue/i,
			})
			.click();

		await page.waitForURL(/\/profile\/documents/, { timeout: 10000 });

		// 4. Click Verified Document and Audit Visual Preview Overlay
		await page
			.getByRole("button", {
				name: /Identität und persönliche Dokumente|Identity and personal documents/i,
			})
			.click();
		const previewBtn = page.getByTestId("preview-doc-btn-id_card");
		await expect(previewBtn).toBeVisible({ timeout: 10000 });
		await previewBtn.click();

		// Explicit Positive Visual Assertion
		const iframe = page.getByTestId("document-preview-iframe");
		await expect(iframe).toBeVisible({ timeout: 15000 });

		await page.screenshot({
			path: path.join(
				MVP_SCREENSHOTS_DIR,
				"20_citizen_document_preview_pdf.png",
			),
		});

		// Overlay Overlap / Close Defense
		await page.getByTestId("preview-close-button").click();
		await expect(iframe).not.toBeVisible({ timeout: 5000 });

		// 5. Upload an Image Document (ID Card PNG)
		const otherSlotBtn = page.getByTestId("slot-btn-health_insurance");
		await expect(otherSlotBtn).toBeVisible({ timeout: 5000 });
		await otherSlotBtn.click();

		const idCardImgPath = path.join(
			MVP_DOCS_DIR,
			"Personalausweis_ Helmut_Klar.png",
		);
		await page.setInputFiles("input[type='file']", idCardImgPath);

		await page.getByTestId("upload-confirm-button").click();
		await page.waitForURL(/\/profile\/documents/, { timeout: 90000 });

		await page.waitForTimeout(3500);

		// Trigger Review if not already on the review page
		if (!page.url().includes("/review")) {
			const imgReviewBtn = page
				.locator("div", { hasText: "Personalausweis_ Helmut_Klar.png" })
				.getByRole("button", { name: /Prüfen|Review/i })
				.first();
			await expect(imgReviewBtn).toBeVisible({ timeout: 90000 });
			await imgReviewBtn.click();
		}

		await page.getByTestId("confirm-button").click();
		await page
			.getByRole("button", {
				name: /Weiter|Continue/i,
			})
			.click();

		await page.waitForURL(/\/profile\/documents/, { timeout: 10000 });

		await page
			.getByRole("button", {
				name: /Identität und persönliche Dokumente|Identity and personal documents/i,
			})
			.click();
		const imgPreviewBtn = page.getByTestId("preview-doc-btn-health_insurance");
		await expect(imgPreviewBtn).toBeVisible({ timeout: 10000 });
		await imgPreviewBtn.click();

		// Explicit Positive Visual Assertion for Image Preview
		const imgPreview = page.getByTestId("document-preview-image");
		await expect(imgPreview).toBeVisible({ timeout: 15000 });

		await page.screenshot({
			path: path.join(
				MVP_SCREENSHOTS_DIR,
				"21_citizen_document_preview_img.png",
			),
		});

		await page.getByTestId("preview-close-button").click();
		await expect(imgPreview).not.toBeVisible({ timeout: 5000 });
	});
});
