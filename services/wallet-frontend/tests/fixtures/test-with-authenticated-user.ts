import { test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

export { expect } from "@playwright/test";

const MOCK_PROFILE = {
	personalData: {
		firstName: "Max",
		lastName: "Mustermann",
		legalGender: "Male",
		dateOfBirth: "1950-01-01",
		placeOfBirth: "Berlin",
	},
};

const MOCK_AUTH_SESSION = {
	state: {
		token: "mock-token",
		status: "SUCCESS_RETURNING",
		phoneNumber: "+4930231250005",
	},
	version: 1,
};

const MOCK_TUTORIAL_SESSION = {
	state: {
		initialized: true,
		tutorials: [
			{
				id: "8d8f41b2-c022-4a21-bc53-5d212eef32f1",
				slug: "wie-funktioniert-die-applikation",
				title: {
					de: "Wie funktioniert die Applikation?",
					en: "How does the application work?",
				},
				subtitle: { de: "", en: "" },
				progress: { status: "completed", current_step: null },
				steps: [],
			},
		],
	},
	version: 1,
};

type AuthFixtures = { authenticatedPage: Page };

export async function seedAuthenticatedUser(page: Page) {
	await page.addInitScript(
		({ auth, tutorial, profile }) => {
			sessionStorage.setItem("beyond-forms-auth-session", JSON.stringify(auth));
			sessionStorage.setItem(
				"beyond-forms-tutorial-session",
				JSON.stringify(tutorial),
			);
			localStorage.setItem(
				"beyond-forms-mock-profile-default",
				JSON.stringify(profile),
			);
		},
		{
			auth: MOCK_AUTH_SESSION,
			tutorial: MOCK_TUTORIAL_SESSION,
			profile: MOCK_PROFILE,
		},
	);
}

export const testWithAuthenticatedUser = base.extend<AuthFixtures>({
	authenticatedPage: async ({ page }, runWith) => {
		await seedAuthenticatedUser(page);
		await runWith(page);
	},
});
