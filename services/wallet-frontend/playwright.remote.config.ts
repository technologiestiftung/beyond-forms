/* global process */
import { defineConfig, devices } from "@playwright/test";

/**
 * axe-core's rules are the same everywhere, but its inputs are not: contrast,
 * visibility and reflow findings come out of computed styles and layout, so
 * they differ by engine and by viewport. Running the four dedicated a11y specs
 * on one desktop Chromium and one mobile WebKit covers that spread.
 */
const A11Y_SPECS = [
	"**/accessibility.spec.ts",
	"**/audit-a11y.spec.ts",
	"**/chat-a11y.spec.ts",
	"**/profile-a11y.spec.ts",
];

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
			testIgnore: A11Y_SPECS,
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
			testIgnore: A11Y_SPECS,
		},
		{
			name: "firefox",
			use: { ...devices["Desktop Firefox"] },
			testIgnore: A11Y_SPECS,
		},
	],
});
