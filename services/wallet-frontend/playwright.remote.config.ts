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
		navigationTimeout: 30000,
		locale: "de-DE",
	},
	projects: [
		{
			name: "chromium-mobile",
			use: { ...devices["Pixel 5"] },
		},
		{
			name: "chromium-desktop",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "webkit-mobile",
			use: { ...devices["iPhone 14"] },
		},
		{
			name: "webkit-desktop",
			use: { ...devices["Desktop Safari"] },
		},
		{
			name: "firefox",
			use: { ...devices["Desktop Firefox"] },
		},
	],
});
