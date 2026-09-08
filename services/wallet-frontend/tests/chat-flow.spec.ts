import { test, expect } from "@playwright/test";
import {
	ensureAuthenticatedSession,
	generateRandomTestPhoneNumber,
} from "./helpers/auth";

// Against the docker-compose e2e stack, the Gemini call is short-circuited
// server-side (MOCK_LLM_RESPONSES=true) with a canned, unformatted reply —
// this exercises the chat UI plumbing but can't verify the real prompt's
// pronoun-unbolding behavior, since the mock reply has no markdown to strip.
// Against staging/prod it still exercises the real model.
test.describe("Chat Overall Flow (MVP Verification Suite)", () => {
	test.use({ viewport: { width: 393, height: 852 } });

	test("should execute core conversational features, un-bold formal personal pronouns, and allow resetting chat sessions via [+] button", async ({
		page,
		baseURL,
	}) => {
		test.setTimeout(120000);

		// Step 1 & 2: Authenticate session
		const phoneNumber = generateRandomTestPhoneNumber();
		await ensureAuthenticatedSession(page, baseURL, phoneNumber);
		await page.goto("/dashboard");

		// Step 3: Open Chat and verify German un-bolding
		await page.getByTestId("nav-chat-button").click();
		await expect(page.locator('[role="dialog"]')).toBeVisible();

		const chatInput = page.getByTestId("chat-input");
		await chatInput.fill("Hallo, kannst du mir bitte meine Rente erklären?");
		await page.getByTestId("chat-send").click();

		const firstReply = page
			.locator('[data-testid="chat-message-list"] .flex-col')
			.last();
		await expect(firstReply).toBeVisible({ timeout: 15000 });

		const strongTags = firstReply.locator("strong", {
			hasText: /Du|Dein|Dir|Dich|Ihnen|Ihr|you|your/i,
		});
		await expect(strongTags).not.toBeVisible();

		// Step 4: Verify Reset Session [+] button
		await page.getByTestId("new-chat-button").click();
		await page.waitForTimeout(1000); // Allow store reset to propagate
		const childrenAfterReset = page.locator(
			'[data-testid="chat-message-list"] > div > div',
		);
		expect(await childrenAfterReset.count()).toBe(1); // Only WelcomeCard remains

		// Step 5: Verify History
		await page.getByTestId("chat-history-button").click();
		await expect(page.getByTestId("chat-history-placeholder")).toBeVisible();
	});
});
