import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { PDFDocument, PDFName, PDFDict, PDFBool } from "pdf-lib";
import helmutPersona from "../../../demo/personas/helmut.json" with { type: "json" };
import { ensureAuthenticatedSession, isRemoteEnvironment } from "./helpers/auth";
import { gotoWithRetry } from "./helpers/navigation";

const helmut = helmutPersona.profile;

// Derived from demo/personas/helmut.json, the single source of truth the demo
// seeder feeds into the profile the form filler reads.
const HELMUT_EXPECTED_FIELDS: Record<string, string> = {
	"MZ1.3-ET_PersAngFamilienname": helmut.last_name,
	"MZ1.3-ET_PersAngVornamen": helmut.first_name,
	"MZ1.3-ET_PersAngGeburtsort": helmut.place_of_birth,
};

test.describe("Housing Allowance PDF export", () => {
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
		await page.getByTestId("generate-antrag_wohngeld-button").click();

		const downloadButton = page.getByTestId("download-antrag_wohngeld-button");
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
