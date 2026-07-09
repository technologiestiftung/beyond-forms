/* global process */
import { Page, expect } from "@playwright/test";

export function generateRandomTestPhoneNumber(): string {
	const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
	return `3023125${randomDigits}`;
}

export async function registerAuthBypassRoute(page: Page) {
	const bypassKey = process.env.PROD_TEST_BYPASS_KEY;
	if (bypassKey) {
		await page.route("**/login/start", async (route) => {
			const headers = {
				...route.request().headers(),
				"X-BeyondForms-Prod-Test-Key": bypassKey,
			};
			await route.continue({ headers });
		});
	}
}

export async function ensureAuthenticatedSession(
	page: Page,
	baseURL: string | undefined,
	phoneNumber: string = "+4930231250005",
) {
	const isRemote =
		baseURL && !baseURL.includes("localhost") && !baseURL.includes("127.0.0.1");

	if (!isRemote) {
		// Local mock session seeding
		await page.addInitScript((phone) => {
			window.localStorage.setItem("VITE_USE_MOCKS", "true");
			window.sessionStorage.setItem(
				"beyond-forms-auth-session",
				JSON.stringify({
					state: {
						token: "mock-jwt-token",
						status: "SUCCESS_RETURNING",
						phoneNumber: phone,
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
								progress: { status: "completed", current_step: null },
							},
						],
						initialized: true,
					},
					version: 1,
				}),
			);
		}, phoneNumber);
		return;
	}

	// Remote staging: perform actual login
	const cleanPhone = phoneNumber.replace(/^\+49/, ""); // Strip +49 for input

	await registerAuthBypassRoute(page);

	await page.goto("/auth?mode=login");
	await page.getByTestId("phone-input").fill(cleanPhone);
	await page.getByTestId("send-code-button").click();
	await expect(page.getByTestId("otp-form")).toBeVisible({ timeout: 20000 });

	for (let i = 0; i < 6; i++) {
		await page.getByTestId(`otp-input-${i}`).fill("1");
	}

	// Wait for either the registration success button to appear, or a direct redirect to happen
	await Promise.race([
		page.waitForURL(/\/tutorial|\/dashboard/, { timeout: 30000 }),
		page.waitForSelector('[data-testid="registration-success-next-button"]', {
			state: "visible",
			timeout: 30000,
		}),
	]).catch(() => {
		// Suppress errors during race, subsequent assertions will fail with detailed context if needed
	});

	const regSuccessBtn = page.getByTestId("registration-success-next-button");
	if (await regSuccessBtn.isVisible().catch(() => false)) {
		await regSuccessBtn.click();
	}

	// Fetch backend tutorials, patch the app-guide tutorial progress to completed, and seed sessionStorage
	await page.evaluate(async () => {
		const authSessionStr = window.sessionStorage.getItem(
			"beyond-forms-auth-session",
		);
		const authSession = authSessionStr ? JSON.parse(authSessionStr) : null;
		const token = authSession?.state?.token;

		const headers: Record<string, string> = {};
		if (token) {
			headers["Authorization"] = `Bearer ${token}`;
		}

		const listRes = await fetch("/api/cms/my-tutorials", { headers });
		if (!listRes.ok) {
			const body = await listRes.text().catch(() => "no body");
			throw new Error(
				`Failed to fetch tutorials list: Status=${listRes.status}, TokenPresent=${!!token}, Response=${body.slice(0, 100)}`,
			);
		}
		const tutorials = (await listRes.json()) as Array<{
			id: string;
			slug: string;
			progress: { status: string };
		}>;

		const appGuide = tutorials.find(
			(t) => t.slug === "wie-funktioniert-die-applikation",
		);
		if (!appGuide) {
			throw new Error("App guide tutorial not found in CMS response");
		}

		const progressRes = await fetch("/api/cms/my-tutorials/progress", {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...headers,
			},
			body: JSON.stringify({
				tutorial_id: appGuide.id,
				status: "completed",
			}),
		});
		if (!progressRes.ok) {
			throw new Error("Failed to patch tutorial progress to completed");
		}

		// Populate sessionStorage with the exact backend schema to bypass the tutorial view
		window.sessionStorage.setItem(
			"beyond-forms-tutorial-session",
			JSON.stringify({
				state: {
					tutorials: tutorials.map((t) =>
						t.slug === "wie-funktioniert-die-applikation"
							? { ...t, progress: { ...t.progress, status: "completed" } }
							: t,
					),
					initialized: true,
				},
				version: 1,
			}),
		);
	});

	// Direct navigation to the dashboard and wait for it to load
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
}
