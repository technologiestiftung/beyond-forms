/* global process */
import type { Page, Route } from "@playwright/test";
import {
	expect,
	testWithAuthenticatedUser as test,
} from "./fixtures/test-with-authenticated-user";

// Runs against a dev server started with VITE_ELIGIBILITY_ENGINE=shacl, like discovery-flow.spec.ts
test.skip(
	process.env.VITE_ELIGIBILITY_ENGINE !== "shacl",
	"Needs the knowledge-base wizard",
);

type Stored = Record<string, unknown> & {
	associated_persons?: Record<string, unknown>[];
};

/** Plays the backend: GET returns what was stored, POST merges the patch like POST /profile does */
async function serveProfile(page: Page, stored: Stored) {
	const posts: Stored[] = [];
	await page.route("**/api/profile", async (route: Route) => {
		if (route.request().method() === "POST") {
			const patch = route.request().postDataJSON() as Stored;
			posts.push(patch);
			const { validate_entire_form: _flag, ...fields } = patch;
			Object.assign(stored, fields);
			return route.fulfill({ json: { success: true } });
		}
		return route.fulfill({ json: stored });
	});
	return posts;
}

const stepOf = (url: URL) => url.pathname.split("/").pop() ?? "";

async function answerUntilDone(page: Page, answers: Record<string, string>) {
	for (let step = 0; step < 30; step++) {
		await page.waitForURL(
			(url) => url.pathname === "/dashboard" || stepOf(url) in answers,
			{ timeout: 10_000 },
		);
		if (new URL(page.url()).pathname === "/dashboard") {
			return;
		}
		const current = page.url();
		const answer = answers[stepOf(new URL(current))];
		if (stepOf(new URL(current)).endsWith(".nationality")) {
			await page.getByTestId("country-select").selectOption(answer);
		} else if (/^\d{4}-\d{2}-\d{2}$/.test(answer)) {
			await page.getByTestId("dob-date-input").fill(answer);
		} else if (/^[A-Z_]+$/.test(answer) && answer.length > 2) {
			await page.getByTestId(`option-${answer.toLowerCase()}`).click();
		} else {
			await page.getByTestId("text-input").fill(answer);
		}
		await page.getByTestId("next-button").click();
		await page.waitForURL((url) => url.toString() !== current);
	}
	throw new Error("The wizard did not finish within 30 questions");
}

test.describe("Kinderzuschlag wizard from the knowledge base", () => {
	test("asks only what the form still needs and stores it", async ({
		authenticatedPage: page,
	}) => {
		const stored: Stored = {
			first_name: "Sabine",
			last_name: "Beispiel",
			date_of_birth: "1988-04-12",
			associated_persons: [
				{
					association_type: "Child",
					lives_in_household: true,
					date_of_birth: "2018-03-01",
				},
			],
		};
		const posts = await serveProfile(page, stored);

		await page.goto("/dashboard/forms/applicationKinderzuschlag/start");
		await expect(page).toHaveURL(/citizen\.legalGender$/);

		await answerUntilDone(page, {
			"citizen.legalGender": "FEMALE",
			"citizen.nationality": "DE",
			"citizen.street": "Musterstraße",
			"citizen.houseNumber": "12",
			"citizen.zipCode": "10115",
			"citizen.city": "Berlin",
			"citizen.maritalStatus": "DIVORCED",
			"child0.firstName": "Mia",
			"child0.lastName": "Beispiel",
			"citizen.childBenefitNumber": "123FK456789",
			"citizen.iban": "DE89 3704 0044 0532 0130 00",
			"citizen.accountHolder": "Sabine Beispiel",
		});

		expect(stored).toMatchObject({
			legal_gender: "Female",
			nationality: "DE",
			zip_code: "10115",
			marital_status: "Divorced",
			iban: "DE89 3704 0044 0532 0130 00",
			income_entries: [
				{
					income_type: "Child Benefit",
					person_sort_order: null,
					reference_no: "123FK456789",
				},
			],
		});
		expect(stored.associated_persons).toEqual([
			{
				association_type: "Child",
				lives_in_household: true,
				date_of_birth: "2018-03-01",
				first_name: "Mia",
				last_name: "Beispiel",
			},
		]);
		expect(posts.length).toBeGreaterThan(0);
	});

	test("keeps the field while typing instead of re-rendering the question", async ({
		authenticatedPage: page,
	}) => {
		await serveProfile(page, {
			first_name: "Sabine",
			last_name: "Beispiel",
			date_of_birth: "1988-04-12",
			legal_gender: "Female",
			nationality: "DE",
		});

		await page.goto("/dashboard/forms/applicationKinderzuschlag/start");
		await expect(page).toHaveURL(/citizen\.street$/);
		const input = page.getByTestId("text-input");
		await input.click();
		await input.pressSequentially("Musterstraße", { delay: 30 });
		await expect(input).toHaveValue("Musterstraße");
		await expect(input).toBeFocused();
	});

	test("goes back to the previous question of the form", async ({
		authenticatedPage: page,
	}) => {
		await serveProfile(page, {
			first_name: "Sabine",
			last_name: "Beispiel",
			date_of_birth: "1988-04-12",
			legal_gender: "Female",
		});

		await page.goto("/dashboard/forms/applicationKinderzuschlag/start");
		await expect(page).toHaveURL(/citizen\.nationality$/);
		await expect(page.getByTestId("country-select")).toContainText(
			"Deutschland",
		);
		await page.getByTestId("back-button").click();
		await expect(page).toHaveURL(/citizen\.legalGender$/);
		await expect(page.locator('input[value="FEMALE"]')).toBeChecked();
	});

	test("explains a malformed answer and asks again", async ({
		authenticatedPage: page,
	}) => {
		await serveProfile(page, {
			first_name: "Sabine",
			last_name: "Beispiel",
			date_of_birth: "1988-04-12",
			legal_gender: "Female",
			nationality: "DE",
			street: "Musterstraße",
			house_number: "12",
		});

		await page.goto("/dashboard/forms/applicationKinderzuschlag/start");
		await expect(page).toHaveURL(/citizen\.zipCode$/);
		await page.getByTestId("text-input").fill("1011");
		await page.getByTestId("next-button").click();

		await expect(page.getByTestId("wizard-error")).toContainText(
			"Eine Postleitzahl hat fünf Ziffern.",
		);
		await expect(page).toHaveURL(/citizen\.zipCode$/);
	});
});
