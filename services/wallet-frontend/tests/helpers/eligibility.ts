import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Walks the Anspruchsradar from the start screen to the result page.
 *
 * Driven by the question the app is actually showing, never by a predicted sequence. The
 * catalogue's skip conditions depend on the answers — the work-capacity question disappears
 * both above an income threshold AND past the retirement age, the children question only
 * appears for some households — so any hard-coded order is one product decision away from
 * waiting 60 seconds for a button that was correctly skipped.
 *
 * Every step also waits for the route to change before touching the next screen. The
 * numeric screens all share the `number-input` and `next-button` testids, so without that
 * wait a `fill()` can land on the card React is in the middle of unmounting and the answer
 * never reaches the store.
 */
export interface EligibilityAnswers {
	household?:
		| "single"
		| "single_parent"
		| "couple_no_children"
		| "couple_with_children";
	dateOfBirth?: string;
	childDateOfBirth?: string;
	grossIncome?: string;
	partnerGrossIncome?: string;
	netIncome?: string;
	warmRent?: string;
	employed?: boolean;
	receivesBenefits?: boolean;
	assets?:
		| "under_5000"
		| "from_5000_to_15000"
		| "from_15000_to_25000"
		| "over_25000";
	workCapacity?: "full" | "temporarily_reduced" | "permanently_reduced";
	citizenship?: "de_eu" | "non_eu";
	secureResidence?: boolean;
}

type Filled = Required<EligibilityAnswers>;

const DEFAULTS: Filled = {
	household: "single",
	dateOfBirth: "15.01.1994",
	childDateOfBirth: "11.02.2020",
	grossIncome: "900",
	partnerGrossIncome: "0",
	netIncome: "1100",
	warmRent: "650",
	employed: true,
	receivesBenefits: false,
	assets: "under_5000",
	workCapacity: "full",
	citizenship: "de_eu",
	secureResidence: true,
};

const choose = (page: Page, option: string) =>
	page.getByTestId(`option-${option}`).click();

const fillNumber = (page: Page, value: string) =>
	page.getByTestId("number-input").fill(value);

const yesNo = (value: boolean) => (value ? "yes" : "no");

/** One entry per question id in the catalogue. */
const ANSWER_QUESTION: Record<
	string,
	(page: Page, answers: Filled) => Promise<void>
> = {
	household: (page, a) => choose(page, a.household),
	children: async (page, a) => {
		await page.getByTestId("child-date-0").fill(a.childDateOfBirth);
	},
	birthdate: async (page, a) => {
		await page.getByTestId("dob-date-input").fill(a.dateOfBirth);
	},
	germany: (page) => choose(page, "yes"),
	employment: (page, a) => choose(page, yesNo(a.employed)),
	"gross-income": (page, a) => fillNumber(page, a.grossIncome),
	"partner-gross-income": (page, a) => fillNumber(page, a.partnerGrossIncome),
	"work-capacity": (page, a) => choose(page, a.workCapacity),
	"net-income": (page, a) => fillNumber(page, a.netIncome),
	"warm-rent": (page, a) => fillNumber(page, a.warmRent),
	assets: (page, a) => choose(page, a.assets),
	benefits: (page, a) => choose(page, yesNo(a.receivesBenefits)),
	citizenship: (page, a) => choose(page, a.citizenship),
	"residence-status": (page, a) => choose(page, yesNo(a.secureResidence)),
};

const questionIdFrom = (url: string): string =>
	new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";

/** Well above the 14-question catalogue, low enough to fail fast on a routing loop. */
const MAX_STEPS = 25;

export const completeEligibilityCheck = async (
	page: Page,
	answers: EligibilityAnswers = {},
) => {
	const filled: Filled = { ...DEFAULTS, ...answers };

	await page.getByTestId("start-button").click();
	await page.waitForURL(/\/eligibility-check\/[^/]+$/);

	for (let step = 0; step < MAX_STEPS; step += 1) {
		const questionId = questionIdFrom(page.url());
		if (questionId === "result") {
			await expect(page.getByTestId("result-disclaimer")).toBeVisible();
			return;
		}

		const answer = ANSWER_QUESTION[questionId];
		if (!answer) {
			throw new Error(
				`completeEligibilityCheck has no answer for question "${questionId}". ` +
					`Add one to ANSWER_QUESTION when the catalogue gains a question.`,
			);
		}

		await answer(page, filled);
		// The answer has to land in the store before Weiter turns usable; waiting on the
		// button says "the app accepted it" rather than "the keystroke was delivered".
		await expect(page.getByTestId("next-button")).toBeEnabled();
		await page.getByTestId("next-button").click();
		await page.waitForURL((url) => questionIdFrom(url.href) !== questionId);
	}

	throw new Error(
		`The check did not reach the result page within ${MAX_STEPS} questions; ` +
			`stopped at "${questionIdFrom(page.url())}".`,
	);
};
