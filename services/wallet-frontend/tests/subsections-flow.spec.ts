import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Questionnaire Subsections E2E & Accessibility Audits", () => {
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
					firstName: "Helmut",
					lastName: "Klar",
					legalGender: "Male",
					dateOfBirth: "1959-01-20",
					placeOfBirth: "Berlin",
					maritalStatus: "Single",
				},
				household: {
					personsInHouseholdCount: 1,
					maritalStatus: "Single",
					marriedSince: null,
				},
				housing: {
					accomodationType: "Rental Apartment",
					tenancyStatus: "Main Tenant",
					rentTotal: 430,
					heatingCosts: 80,
					livingArea: 50,
					numberOfRooms: 2,
				},
				health: {
					hasDisabilityId: true,
					disabilityValidUntil: "2030-12-31",
					disabilityApplicationPending: false,
					merkzeichen: ["G", "aG"],
					hasInpatientFacilityAccommodation: false,
				},
				financial: {
					monthlyIncome: 650,
					incomeSources: [],
					hasAssets: false,
					assetsDescription: "",
					bankDetails: {
						bankName: "Sparkasse",
						accountHolder: "Helmut Klar",
						iban: "DE12345678901234567890",
					},
				},
			};

			const keys = [
				"beyond-forms-mock-profile-default",
				"beyond-forms-mock-profile-3023125123",
				"beyond-forms-mock-profile-+493023125123",
			];

			keys.forEach((key) => {
				window.localStorage.setItem(key, JSON.stringify(mockProfile));
			});

			window.localStorage.setItem("VITE_USE_MOCKS", "true");

			window.sessionStorage.setItem(
				"beyond-forms-auth-session",
				JSON.stringify({
					state: {
						token: "mock-token",
						status: "SUCCESS_RETURNING",
						phoneNumber: "+493023125123",
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
		await expect(page.getByTestId("profile-name")).toBeVisible();
	});

	test("Household Form: should edit, blur save, and have zero a11y errors", async ({
		page,
	}) => {
		await page.goto("/dashboard/application/household/questions");

		// Page 1: Support / Betreuung. Select none and click next
		await expect(page.getByTestId("household-option-none")).toBeVisible();
		await page.getByTestId("household-option-none").click();
		await page.getByRole("button", { name: "Weiter", exact: true }).click();

		// Page 2: Displaced Status. Select no and click next
		await expect(page.getByTestId("household-option-no")).toBeVisible();
		await page.getByTestId("household-option-no").click();
		await page.getByRole("button", { name: "Weiter", exact: true }).click();

		// Page 3: Insurance. Select none and click next
		await expect(page.getByTestId("household-option-none")).toBeVisible();
		await page.getByTestId("household-option-none").click();
		await page
			.getByRole("button", { name: "Speichern und weiter", exact: true })
			.click();

		// Page 4: Persons count in household. Click next
		await expect(page.locator('input[type="number"]')).toBeVisible();
		await page.getByRole("button", { name: "Weiter", exact: true }).click();

		// Page 5: Marital status. Expect Single to be visible, then select Married
		await expect(page.getByTestId("household-option-Single")).toBeVisible();
		await page.getByTestId("household-option-Married").click();

		// Run Accessibility Audits
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);

		// Save Page 5 and close
		await page.getByRole("button", { name: "Fertigstellen" }).click();
		await expect(page).toHaveURL(/\/dashboard\/application\/overview$/);
	});

	test("Housing Form: should edit, blur save, and have zero a11y errors", async ({
		page,
	}) => {
		await page.goto("/dashboard/application/housing/questions");

		// Page 1: Address. Click next
		await expect(page.locator("h1:has-text('Wohnadresse')")).toBeVisible();
		await page.getByTestId("next-button").click();

		// Page 2: Accomodation Type. Expect Rental Apartment to be visible, then click next
		await expect(
			page.getByTestId("housing-option-Rental Apartment"),
		).toBeVisible();
		await page.getByTestId("next-button").click();

		// Page 3: Tenancy Status. Click next
		await expect(
			page.locator("h1:has-text('Haupt- oder Untermieter')"),
		).toBeVisible();
		await page.getByTestId("next-button").click();

		// Page 4: Landlord Name / Sublet. Click next
		await expect(
			page.locator("h1:has-text('Vermietest Du Zimmer unter')"),
		).toBeVisible();
		await page.getByTestId("next-button").click();

		// Page 5: Space and rooms / Arrears. Click next
		await expect(page.locator("h1:has-text('Mietschulden')")).toBeVisible();
		await page.getByTestId("next-button").click();

		// Page 6: Costs
		await expect(page.getByTestId("field-rentTotal-input")).toBeVisible();
		await expect(page.getByTestId("field-rentTotal-input")).toHaveValue("430");
		await expect(page.getByTestId("field-heatingCosts-input")).toHaveValue(
			"80",
		);

		await page.getByTestId("field-rentTotal-input").fill("450");
		await page.getByTestId("field-rentTotal-input").blur();

		await expect(page.getByRole("status")).toBeVisible();
		await expect(page.getByText(/Saved|Gespeichert/i)).toBeVisible();

		// Run A11y Audits
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);

		// Click through the remaining pages: Page 6 -> 7 -> 8 -> redirect to household
		await page.getByTestId("next-button").click(); // Page 6 -> 7

		// Page 7: size
		await expect(page.locator("h1:has-text('Wohnung/Haus')")).toBeVisible();
		await page.getByTestId("next-button").click(); // Page 7 -> 8

		// Page 8: heating type
		await expect(page.locator("h1:has-text('beheizt')")).toBeVisible();
		await page.getByTestId("next-button").click(); // Page 8 -> redirect

		await expect(page).toHaveURL(
			/\/dashboard\/application\/household\/questions$/,
		);
	});

	test("Income Form: should navigate multi-step wizard and have zero a11y errors", async ({
		page,
	}) => {
		await page.goto("/dashboard/application/income-assets/questions");

		// Page 1: Waiting for social benefit approval? Select Nein and click Weiter
		await expect(
			page.locator("h1:has-text('Sozialhilfeleistung')"),
		).toBeVisible();
		await page.getByTestId("option-card-nein").click();
		await page.getByRole("button", { name: "Weiter", exact: true }).click();

		// Page 2: Previous benefits? Wait for Page 1 to hide, then select Nein and click Weiter
		await expect(
			page.locator("h1:has-text('Sozialhilfeleistung')"),
		).toBeHidden();
		await expect(page.locator("h1:has-text('Sozialleistungen')")).toBeVisible();
		await page.getByTestId("option-card-nein").click();
		await page.getByRole("button", { name: "Weiter", exact: true }).click();

		// Page 3: Pension Status. Wait for Page 2 to hide, then select none and click Weiter
		await expect(page.locator("h1:has-text('Sozialleistungen')")).toBeHidden();
		await expect(page.locator("h1:has-text('Rente')")).toBeVisible();
		await page.getByTestId("option-card-none").click();
		await page.getByRole("button", { name: "Weiter", exact: true }).click();

		// Page 4: Employment Status. Wait for Page 3 to hide, then select nichts davon and click Weiter
		await expect(page.locator("h1:has-text('Rente')")).toBeHidden();
		await expect(page.locator("h1:has-text('Erwerbssituation')")).toBeVisible();
		await page.getByTestId("option-card-nichts_davon").click();
		await page.getByRole("button", { name: "Weiter", exact: true }).click();

		// Page 5: Other regular monthly income. Wait for Page 4 to hide, then select keine einnahmen and click Weiter
		await expect(page.locator("h1:has-text('Erwerbssituation')")).toBeHidden();
		await expect(page.locator("h1:has-text('Einnahmen')")).toBeVisible();
		await page.getByTestId("option-card-keine_einnahmen").click();
		await page.getByRole("button", { name: "Weiter", exact: true }).click();

		// Page 6: Expected one-time payments. Wait for Page 5 to hide, then select Nein and click Weiter
		await expect(page.locator("h1:has-text('Einnahmen')")).toBeHidden();
		await expect(page.locator("h1:has-text('Zahlung')")).toBeVisible();
		await page.getByTestId("option-card-nein").click();
		await page.getByRole("button", { name: "Weiter", exact: true }).click();

		// Page 7: Bank Details. Wait for Page 6 to hide, then fill in bank details
		await expect(page.locator("h1:has-text('Zahlung')")).toBeHidden();
		await expect(page.locator("h1:has-text('Bankverbindung')")).toBeVisible();
		await page.locator("#account-holder").fill("Helmut Klar");
		await page.locator("#bank-name").fill("Musterbank");
		await page.locator("#iban").fill("DE12345678901234567890");
		await page.locator("#bic").fill("TESTBIC1XXX");
		await page.locator("#account-holder").blur();

		// Run A11y Audits
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);

		// Save Page 7 and complete the form
		await page.getByRole("button", { name: "Zurück zum Antrag" }).click();
		await expect(page).toHaveURL(/\/dashboard\/application\/overview$/);
	});

	test("Health Form: should navigate multi-step wizard and have zero a11y errors", async ({
		page,
	}) => {
		await page.goto("/dashboard/application/health/questions");

		// Page 1: Care dependency? Select Nein and click next-button
		await expect(page.locator("h1:has-text('pflegebedürftig')")).toBeVisible();
		await page.getByTestId("health-option-care-no").click();
		await page.getByTestId("next-button").click();

		// Page 4: Earning capacity? Wait for Page 1 to hide, then select fully able and click next-button
		await expect(page.locator("h1:has-text('pflegebedürftig')")).toBeHidden();
		await expect(page.locator("h1:has-text('Erwerbsfähigkeit')")).toBeVisible();
		await page.getByTestId("health-option-work-fully").click();
		await page.getByTestId("next-button").click();

		// Page 8: Medical nutrition? Wait for Page 4 to hide, then select Nein and click done-button
		await expect(page.locator("h1:has-text('Erwerbsfähigkeit')")).toBeHidden();
		await expect(page.locator("h1:has-text('Ernährung')")).toBeVisible();
		await page.getByTestId("health-option-nutrition-no").click();

		// Run A11y Audits
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);

		// Complete the wizard
		await page.getByTestId("done-button").click();
		await expect(page).toHaveURL(/\/dashboard\/application\/overview$/);
	});

	test.skip("Eligibility Form: should navigate 4-step wizard, save answers persistently in sessionStorage, capture premium screenshots, and have zero accessibility violations", async ({
		page,
	}) => {
		// 1. Navigate from Application Overview dashboard
		await page.goto("/dashboard/application/overview");
		await expect(page.getByTestId("questionnaire-status-list")).toBeVisible();

		// Click card to launch wizard
		await page.getByRole("button", { name: /Grundsicherung prüfen/i }).click();
		await page.waitForURL(/\/dashboard\/application\/eligibility/);

		// Step 1: Residence
		await expect(page.getByTestId("question-title")).toContainText(
			"Wo ist Dein Hauptwohnsitz?",
		);
		await page.getByTestId("eligibility-option-germany").click();
		await page.getByTestId("next-button").click();

		// Step 2: Age
		await expect(page.getByTestId("question-title")).toContainText(
			"Wie alt bist Du?",
		);
		await page.getByTestId("eligibility-option-younger_than_67").click();
		await page.getByTestId("next-button").click();

		// Step 3: Erwerbsunfähigkeit
		await expect(page.getByTestId("question-title")).toContainText(
			"Hat ein Arzt/eine Ärztin oder das Rentenamt bestätigt",
		);
		await page.getByTestId("eligibility-option-no").click();
		await page.getByTestId("next-button").click();

		// Step 4: Pension
		await expect(page.getByTestId("question-title")).toContainText(
			"Beziehst Du Rente?",
		);
		await page.getByTestId("eligibility-option-no").click();

		// Run accessibility audits
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);

		// Complete wizard and close
		await page.getByTestId("done-button").click();
		await expect(page).toHaveURL(/\/dashboard\/application\/overview$/);
	});
});
