/* global process */
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Playwright's Firefox before 158 reads the real Firefox app-data folder, which macOS 27
// protects, and exits with "Could not find profile folder". A home folder of its own keeps
// it away from that folder. Remove once on Playwright >= 1.65 (microsoft/playwright#42768).
function firefoxLaunchOptions() {
	if (process.platform !== "darwin") {
		return {};
	}
	const home = join(tmpdir(), "playwright-firefox-home");
	mkdirSync(home, { recursive: true });
	return {
		launchOptions: { env: { ...process.env, CFFIXED_USER_HOME: home } },
	};
}

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!(typeof process !== "undefined" && process.env.CI),
	retries: typeof process !== "undefined" && process.env.CI ? 2 : 0,
	workers: typeof process !== "undefined" && process.env.CI ? 1 : undefined,
	reporter: "html",
	use: {
		baseURL: "http://localhost:5173",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		locale: "de-DE",
	},
	projects: [
		{
			name: "chromium-desktop",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "chromium-mobile",
			use: { ...devices["Galaxy S24"] },
		},
		{
			name: "firefox-desktop",
			use: { ...devices["Desktop Firefox"], ...firefoxLaunchOptions() },
		},
		{
			name: "webkit-desktop",
			use: { ...devices["Desktop Safari"] },
		},
		{
			name: "webkit-mobile",
			use: { ...devices["iPhone 14"] },
		},
	],
	webServer: {
		command: "npm run dev",
		url: "http://localhost:5173",
		reuseExistingServer: !(typeof process !== "undefined" && process.env.CI),
		env: {
			VITE_USE_MOCK_AUTH: "true",
			VITE_USE_MOCKS: "true",
			VITE_E2E_TEST: "true",
		},
	},
});
