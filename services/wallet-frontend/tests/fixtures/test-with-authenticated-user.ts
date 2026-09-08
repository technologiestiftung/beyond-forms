import { test as base } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
	ensureAuthenticatedSession,
	generateRandomTestPhoneNumber,
	isRemoteEnvironment,
} from "../helpers/auth";

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

type SeedData = {
	auth: string;
	tutorial: string;
	profile?: string;
};

type AuthWorkerFixtures = { authSessionData: SeedData };

export async function seedAuthenticatedUser(page: Page, data?: SeedData) {
	const seed = data ?? {
		auth: JSON.stringify(MOCK_AUTH_SESSION),
		tutorial: JSON.stringify(MOCK_TUTORIAL_SESSION),
		profile: JSON.stringify(MOCK_PROFILE),
	};
	await page.addInitScript((seed) => {
		sessionStorage.setItem("beyond-forms-auth-session", seed.auth);
		sessionStorage.setItem("beyond-forms-tutorial-session", seed.tutorial);
		if (seed.profile) {
			localStorage.setItem("beyond-forms-mock-profile-default", seed.profile);
		}
	}, seed);
}

export const testWithAuthenticatedUser = base.extend<
	AuthFixtures,
	AuthWorkerFixtures
>({
	// Fake sessionStorage seeding only works against the local mock backend.
	// Against a real deployed environment (staging/prod), a fabricated token
	// is rejected by the first real API call, logging the session straight
	// back out. So on remote runs we log in for real, once per worker, and
	// reuse the resulting session across every test in that worker.
	authSessionData: [
		async ({ browser }, use, workerInfo) => {
			const baseURL = workerInfo.project.use.baseURL as string | undefined;
			const isRemote = isRemoteEnvironment(baseURL);

			if (!isRemote) {
				await use({
					auth: JSON.stringify(MOCK_AUTH_SESSION),
					tutorial: JSON.stringify(MOCK_TUTORIAL_SESSION),
					profile: JSON.stringify(MOCK_PROFILE),
				});
				return;
			}

			const context = await browser.newContext();
			const loginPage = await context.newPage();
			await ensureAuthenticatedSession(
				loginPage,
				baseURL,
				generateRandomTestPhoneNumber(),
			);
			const captured = await loginPage.evaluate(() => ({
				auth: sessionStorage.getItem("beyond-forms-auth-session"),
				tutorial: sessionStorage.getItem("beyond-forms-tutorial-session"),
			}));
			await context.close();

			if (!captured.auth || !captured.tutorial) {
				throw new Error(
					"testWithAuthenticatedUser: failed to capture a real authenticated session for this worker.",
				);
			}

			await use({ auth: captured.auth, tutorial: captured.tutorial });
		},
		{ scope: "worker" },
	],

	authenticatedPage: async ({ page, authSessionData }, runWith) => {
		await seedAuthenticatedUser(page, authSessionData);
		await runWith(page);
	},
});
