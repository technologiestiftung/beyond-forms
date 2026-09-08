import type { Page } from "@playwright/test";

const MAX_ATTEMPTS = 3;

/**
 * WebKit fails a navigation with a bare "WebKit encountered an internal error"
 * when the app is still settling a client-side redirect from the previous one —
 * which is exactly the state the auth helper hands over to a spec that
 * navigates again right after login. Firefox and Chromium surface the same race
 * as an aborted or interrupted navigation instead.
 */
const TRANSIENT_NAVIGATION_ERRORS =
	/internal error|Navigation interrupted|NS_BINDING_ABORTED|net::ERR_ABORTED|frame was detached/i;

/** Navigates, retrying the browser-level races above. */
export async function gotoWithRetry(page: Page, url: string) {
	for (let attempt = 1; ; attempt++) {
		try {
			await page.goto(url, { waitUntil: "domcontentloaded" });
			return;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (
				attempt >= MAX_ATTEMPTS ||
				!TRANSIENT_NAVIGATION_ERRORS.test(message)
			) {
				throw error;
			}
			await page.waitForTimeout(1000);
		}
	}
}
