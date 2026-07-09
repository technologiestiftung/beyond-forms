/* global process */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!(typeof process !== "undefined" && process.env.CI),
	retries: typeof process !== "undefined" && process.env.CI ? 2 : 0,
	workers: typeof process !== "undefined" && process.env.CI ? 1 : undefined,
	reporter: "html",
	use: {
		baseURL: "http://localhost:5173",
		trace: "on",
		screenshot: "on",
		locale: "de-DE",
	},
	projects: [
		{
			name: "desktop",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "mobile",
			use: { ...devices["Galaxy S24"] },
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
