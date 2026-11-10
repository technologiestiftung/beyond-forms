/* global process */
import { test, expect, type Page } from "@playwright/test";
import { submitAnswer } from "./helpers/eligibility";

// Runs against a dev server started with VITE_ELIGIBILITY_ENGINE=shacl, e.g.
// VITE_ELIGIBILITY_ENGINE=shacl npx playwright test discovery-flow
test.skip(
	process.env.VITE_ELIGIBILITY_ENGINE !== "shacl",
	"Needs the knowledge-base eligibility check",
);

type Answer = string | number | string[];

/** The engine picks the order, so answer whichever question it asks next */
async function answerUntilResult(page: Page, answers: Record<string, Answer>) {
	await page.getByTestId("start-button").click();
	const stepOf = (url: URL) => url.pathname.split("/").pop() ?? "";
	for (let step = 0; step < 20; step++) {
		// Unknown steps, like the legacy start route, redirect to the engine's next question
		await page
			.waitForURL((url) => stepOf(url) === "result" || stepOf(url) in answers, {
				timeout: 10_000,
			})
			.catch(() => {
				throw new Error(`Unexpected question ${stepOf(new URL(page.url()))}`);
			});
		const questionId = stepOf(new URL(page.url()));
		if (questionId === "result") {
			return;
		}
		const answer = answers[questionId];
		if (Array.isArray(answer)) {
			for (const [index, date] of answer.entries()) {
				if (index > 0) {
					await page.getByTestId("add-child").click();
				}
				await page.getByTestId(`child-date-input-${index}`).fill(date);
			}
		} else if (typeof answer === "number") {
			await page.getByTestId("number-input").fill(String(answer));
		} else if (/^\d{4}-\d{2}-\d{2}$/.test(answer)) {
			await page.getByTestId("dob-date-input").fill(answer);
		} else {
			await page.getByTestId(`option-${answer.toLowerCase()}`).click();
		}
		await submitAnswer(page);
	}
	throw new Error("The check did not finish within 20 questions");
}

test.describe("Knowledge-base eligibility check", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	test("Pensioner living alone", async ({ page }) => {
		await answerUntilResult(page, {
			householdComposition: "single",
			birthDate: "1955-01-01",
			livesInGermany: "yes",
			monthlyNetHouseholdIncome: 800,
			monthlyWarmRent: 600,
			monthlyGrossHouseholdIncome: 900,
			incomeDeductions: "health",
			monthlyRentWithoutHeating: 480,
			assetsBand: "under_5000",
			citizenship: "german",
		});

		await expect(
			page.getByTestId("benefit-grundsicherungimalter"),
		).toHaveAttribute("data-status", "eligible");
		await expect(page.getByTestId("benefit-wohngeld")).toHaveAttribute(
			"data-status",
			"eligible",
		);
		await expect(
			page.getByTestId("benefit-grundsicherungsgeld"),
		).toHaveAttribute("data-status", "ineligible");
		await expect(page.getByTestId("benefit-kinderzuschlag")).toHaveAttribute(
			"data-status",
			"ineligible",
		);
	});

	test("Working single parent", async ({ page }) => {
		await answerUntilResult(page, {
			householdComposition: "single_parent",
			hasChild: ["2018-03-01"],
			birthDate: "1990-05-01",
			livesInGermany: "yes",
			isEmployed: "yes",
			monthlyGrossIncome: 1800,
			workCapacity: "full",
			monthlyNetHouseholdIncome: 1500,
			monthlyWarmRent: 700,
			monthlyGrossHouseholdIncome: 1800,
			incomeDeductions: "tax_health_pension",
			monthlyRentWithoutHeating: 600,
			assetsBand: "under_5000",
			citizenship: "eu",
		});

		await expect(page.getByTestId("benefit-kinderzuschlag")).toHaveAttribute(
			"data-status",
			"eligible",
		);
	});

	test("Living abroad ends the check after one question", async ({ page }) => {
		await answerUntilResult(page, {
			householdComposition: "single",
			livesInGermany: "no",
		});

		await expect(page).toHaveURL(/\/eligibility-check\/result/);
		await expect(page.getByTestId("benefit-wohngeld")).toHaveCount(0);
	});

	test("Typing an amount does not re-render the question", async ({ page }) => {
		const choices: Record<string, string> = {
			householdComposition: "single",
			livesInGermany: "yes",
			citizenship: "german",
			workCapacity: "full",
			assetsBand: "under_5000",
			isEmployed: "no",
			incomeDeductions: "none",
		};
		await page.getByTestId("start-button").click();
		const amount = page.getByTestId("number-input");
		// Answer choices and dates in whatever order the engine asks until an amount comes up
		for (let step = 0; step < 10 && !(await amount.isVisible()); step++) {
			await page.waitForURL(
				(url) => (url.pathname.split("/").pop() ?? "") !== "household",
			);
			const questionId = new URL(page.url()).pathname.split("/").pop() ?? "";
			if (await page.getByTestId("dob-date-input").isVisible()) {
				await page.getByTestId("dob-date-input").fill("1990-05-01");
			} else if (questionId in choices) {
				await page.getByTestId(`option-${choices[questionId]}`).click();
			} else {
				break;
			}
			await submitAnswer(page);
		}

		await amount.click();
		await amount.pressSequentially("1250", { delay: 30 });
		await expect(amount).toHaveValue("1250");
		await expect(amount).toBeFocused();
	});

	test("Back returns to the previous answer", async ({ page }) => {
		await page.getByTestId("start-button").click();
		await page.getByTestId("option-single").click();
		await submitAnswer(page);
		await page.getByTestId("back-button").click();
		await expect(page).toHaveURL(/\/eligibility-check\/householdComposition/);
		await expect(page.locator('input[value="SINGLE"]')).toBeChecked();
	});
});
