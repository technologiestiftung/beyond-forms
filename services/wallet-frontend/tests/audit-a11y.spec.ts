import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { testWithAuthenticatedUser } from "./fixtures/test-with-authenticated-user";
import { waitForFadeInAnimations, waitForPageReady } from "./helpers/a11y";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

async function assertNoViolations(page: Page) {
	await waitForPageReady(page);
	const results = await new AxeBuilder({ page })
		.withTags([...WCAG_TAGS])
		.analyze();
	expect(results.violations).toEqual([]);
}

async function assertNoViolationsIn(page: Page, selector: string) {
	await waitForPageReady(page);
	const results = await new AxeBuilder({ page })
		.include(selector)
		.withTags([...WCAG_TAGS])
		.analyze();
	expect(results.violations).toEqual([]);
}

async function completeEligibilityFlow(page: Page) {
	await page.getByTestId("start-button").click();
	await page.getByTestId("option-german").click();
	await page.getByTestId("next-button").click();
	await page.getByTestId("option-yes").click();
	await page.getByTestId("next-button").click();
	await page.getByTestId("dob-date-input").fill("1955-01-01");
	await page.getByTestId("next-button").click();
	await page.getByTestId("option-old_age").click();
	await page.getByTestId("next-button").click();
	await page.getByTestId("option-not_sufficient").click();
	await page.getByTestId("next-button").click();
	await page.getByTestId("option-no").click();
	await page.getByTestId("next-button").click();
	await expect(page.getByTestId("outcome-title")).toBeVisible();
	await waitForFadeInAnimations(page, "outcome-title");
}

test.describe("Deep Accessibility Audit - WCAG 2.1 AA", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		await page.reload();
		await waitForPageReady(page);
	});

	test("Eligibility Start: Intro carousel should be accessible", async ({
		page,
	}) => {
		await expect(page.getByTestId("intro-carousel-track")).toBeVisible();
		await assertNoViolations(page);
	});

	test("Eligibility Flow: Deep Question Audit", async ({ page }) => {
		await page.getByTestId("start-button").click();
		await assertNoViolations(page);

		await page.getByTestId("option-german").click();
		await page.getByTestId("next-button").click();
		await assertNoViolations(page);

		await page.getByTestId("option-yes").click();
		await page.getByTestId("next-button").click();
		await assertNoViolations(page);

		await page.getByTestId("dob-date-input").fill("1955-01-01");
		await page.getByTestId("next-button").click();
		await assertNoViolations(page);
	});

	test("Interactive Elements: Focus states and touch targets", async ({
		page,
	}) => {
		const results = await new AxeBuilder({ page })
			.include("button")
			.include("a")
			.withTags([...WCAG_TAGS])
			.analyze();

		expect(results.violations).toEqual([]);
	});

	test("Auth phone form", async ({ page }) => {
		await page.goto("/auth");
		await expect(page.getByTestId("phone-number-form")).toBeVisible();
		await assertNoViolations(page);
	});

	test("Auth OTP form", async ({ page }) => {
		await page.goto("/auth");
		await page.getByTestId("phone-input").fill("30231250004");
		await page.getByTestId("send-code-button").click();
		await expect(page.getByTestId("otp-form")).toBeVisible();
		await waitForFadeInAnimations(page, "otp-form");
		await assertNoViolations(page);
	});

	test("Eligibility result", async ({ page }) => {
		await completeEligibilityFlow(page);
		await assertNoViolations(page);
	});
});

testWithAuthenticatedUser.describe(
	"Deep Accessibility Audit - Authenticated Routes",
	() => {
		testWithAuthenticatedUser(
			"Dashboard",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Application overview",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard/application/overview");
				await expect(page.getByTestId("segmented-progress-bar")).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Application about-me intro",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard/application/about-me");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Application about-me questions",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard/application/about-me/questions");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Application household questions",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard/application/household");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Application housing intro",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard/application/housing");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Application housing questions",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard/application/housing/questions");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Application income-assets intro",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard/application/income-assets");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Application income-assets questions",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard/application/income-assets/questions");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Application health intro",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard/application/health");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Application health questions",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard/application/health/questions");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Application upload options",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard/application/upload-options");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Profile hub",
			async ({ authenticatedPage: page }) => {
				await page.goto("/profile");
				await expect(page.getByTestId("profile-name")).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Profile personal data edit",
			async ({ authenticatedPage: page }) => {
				await page.goto("/profile/personal/edit");
				await expect(page.getByTestId("field-firstName-input")).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Profile documents (empty state)",
			async ({ authenticatedPage: page }) => {
				await page.goto("/profile/documents");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Profile settings",
			async ({ authenticatedPage: page }) => {
				await page.goto("/profile/settings");
				await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
				await assertNoViolations(page);
			},
		);
	},
);

testWithAuthenticatedUser.describe(
	"Deep Accessibility Audit - Extra States",
	() => {
		testWithAuthenticatedUser(
			"Personal data edit with validation error",
			async ({ authenticatedPage: page }) => {
				await page.goto("/profile/personal/edit");
				await expect(page.getByTestId("field-firstName-input")).toBeVisible();

				const zipInput = page.getByTestId("field-zipCode-input");
				await zipInput.fill("123456789012345");
				await zipInput.blur();
				await expect(page.getByTestId("field-zipCode-error")).toBeVisible();

				await assertNoViolations(page);
			},
		);

		testWithAuthenticatedUser(
			"Chat sheet open",
			async ({ authenticatedPage: page }) => {
				await page.goto("/dashboard");
				await waitForPageReady(page);

				const chatToggle = page
					.getByTestId("nav-chat-button")
					.or(page.getByTestId("nav-chat-sidebar"))
					.or(page.getByRole("button", { name: /Chat/i }))
					.filter({ visible: true })
					.first();
				await chatToggle.click();
				await expect(page.locator('[role="dialog"]')).toBeVisible();
				await expect(page.getByTestId("chat-input")).toBeVisible();

				await assertNoViolationsIn(page, '[role="dialog"]');
			},
		);
	},
);
