import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { PDFDocument, PDFName, PDFDict, PDFBool } from "pdf-lib";
import helmutPersona from "../../../demo/personas/helmut.json" with { type: "json" };
import { ensureAuthenticatedSession, isRemoteEnvironment } from "./helpers/auth";
import { gotoWithRetry } from "./helpers/navigation";

const helmut = helmutPersona.profile;

// Mirrors forms/mappings/antrag_bewohnerparkausweis.toml so a persona edit
// (demo/personas/helmut.json is the seed's single source of truth) can't
// silently break this test.
const HELMUT_EXPECTED_FIELDS: Record<string, string> = {
	Kennzeichen: helmut.license_plate,
	"Name Vorname Antragsteller": `${helmut.last_name}, ${helmut.first_name}`,
	"Straße HausNr Antragsteller": `${helmut.street} ${helmut.house_number}`,
	"PLZ Wohnort Antragsteller": `${helmut.zip_code} ${helmut.city}`,
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
		await ensureAuthenticatedSession(page, baseURL, helmutPersona.phone_number);

		await gotoWithRetry(page, "/dashboard");
		await page
			.getByTestId("generate-antrag_bewohnerparkausweis-button")
			.click();

		const downloadButton = page.getByTestId(
			"download-antrag_bewohnerparkausweis-button",
		);
		await expect(downloadButton).toBeVisible({ timeout: 30000 });

		const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
		await downloadButton.click();
		const download = await downloadPromise;
		const downloadPath = await download.path();
		expect(downloadPath).toBeTruthy();
		const pdfBytes = readFileSync(downloadPath as string);

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
