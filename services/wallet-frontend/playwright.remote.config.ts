/* global process */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	timeout: 60000,
	retries: typeof process !== "undefined" && process.env.CI ? 2 : 0,
	workers: typeof process !== "undefined" && process.env.CI ? 2 : undefined,
	fullyParallel: false,
	use: {
		baseURL:
			process.env.PLAYWRIGHT_BASE_URL ||
			"https://staging.bf.citylab-berlin.org",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "on-first-retry",
		viewport: { width: 390, height: 844 }, // Mobile viewport since Klaro is mobile-first
		deviceScaleFactor: 3,
		isMobile: true,
		hasTouch: true,
		navigationTimeout: 30000,
		locale: "de-DE",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Pixel 5"] }, // Use Pixel 5 to emulate mobile behavior
		},
	],
});
