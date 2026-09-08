import { test, expect } from "@playwright/test";
import { PDFDocument, PDFName, PDFDict, PDFBool } from "pdf-lib";
import { ensureAuthenticatedSession, isRemoteEnvironment } from "./helpers/auth";

const HELMUT_PHONE = "+493023125102";
const HELMUT_EXPECTED_FIELDS: Record<string, string> = {
	Kennzeichen: "B-HK 1947",
	"Name Vorname Antragsteller": "Klar, Helmut",
	"Straße HausNr Antragsteller": "Hauptstraße 4",
	"PLZ Wohnort Antragsteller": "10820 Berlin",
};

test.describe("Parking Permit PDF export", () => {
	test.beforeEach(async ({ baseURL }) => {
		if (!isRemoteEnvironment(baseURL)) {
			test.skip();
		}
	});

	test("fills text fields with real data and clears /NeedAppearances", async ({
		page,
		baseURL,
	}) => {
		await ensureAuthenticatedSession(page, baseURL, HELMUT_PHONE);

		await page.goto("/dashboard");
		await page
			.getByTestId("generate-antrag_bewohnerparkausweis-button")
			.click();

		const openLink = page.getByTestId("open-antrag_bewohnerparkausweis-link");
		await expect(openLink).toBeVisible({ timeout: 30000 });
		const href = await openLink.getAttribute("href");
		expect(href).toBeTruthy();

		const response = await page.request.get(href as string);
		expect(response.ok()).toBeTruthy();
		const pdfBytes = await response.body();

		const pdfDoc = await PDFDocument.load(pdfBytes);
		const form = pdfDoc.getForm();

		for (const [fieldName, expectedValue] of Object.entries(
			HELMUT_EXPECTED_FIELDS,
		)) {
			const value = form.getTextField(fieldName).getText();
			expect(value, `field "${fieldName}"`).toBe(expectedValue);
		}

		const acroFormRef = pdfDoc.catalog.get(PDFName.of("AcroForm"));
		const acroForm = pdfDoc.context.lookup(acroFormRef, PDFDict);
		const needAppearances = acroForm.get(PDFName.of("NeedAppearances"));
		expect(
			needAppearances === undefined || needAppearances === PDFBool.False,
			"AcroForm /NeedAppearances must not be true, or Chrome/Safari regenerate " +
				"their own (blank) appearance instead of using the baked-in one",
		).toBe(true);
	});
});
