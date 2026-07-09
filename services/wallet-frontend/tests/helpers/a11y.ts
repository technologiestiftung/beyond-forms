import { expect, type Page } from "@playwright/test";

/** Framer Motion enter transitions (AuthView, EligibilityResult, etc.) use 300ms */
const FADE_IN_BUFFER_MS = 100;

/**
 * Waits until the anchor element and all ancestors have full opacity.
 * Framer Motion fade-ins otherwise cause false color-contrast failures in axe.
 */
export async function waitForFadeInAnimations(
	page: Page,
	anchorTestId?: string,
) {
	await page
		.waitForFunction(
			(testId) => {
				const anchor = testId
					? document.querySelector(`[data-testid="${testId}"]`)
					: (document.querySelector('[data-testid="auth-view"]') ??
						document.querySelector("main") ??
						document.body);

				let el: Element | null = anchor;
				while (el) {
					if (parseFloat(window.getComputedStyle(el).opacity) < 0.99) {
						return false;
					}
					el = el.parentElement;
				}
				return true;
			},
			anchorTestId ?? null,
			{ timeout: 10_000 },
		)
		.catch(() => undefined);

	await page.waitForTimeout(FADE_IN_BUFFER_MS);
}

export async function waitForPageReady(page: Page, anchorTestId?: string) {
	await expect(page.locator(".animate-spin")).not.toBeVisible();
	await waitForFadeInAnimations(page, anchorTestId);
}
