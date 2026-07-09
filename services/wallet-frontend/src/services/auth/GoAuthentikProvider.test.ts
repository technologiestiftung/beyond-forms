import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GoAuthentikProvider } from "./GoAuthentikProvider";

vi.mock("../../config/env.config", () => ({
	env: {
		VITE_AUTH_URL: "/auth-proxy",
		VITE_USE_MOCKS: false,
		VITE_USE_MOCK_AUTH: false,
	},
}));

describe("GoAuthentikProvider", () => {
	let provider: GoAuthentikProvider;

	beforeEach(() => {
		provider = new GoAuthentikProvider();
		vi.stubGlobal("fetch", vi.fn());
		window.sessionStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	describe("startFlow", () => {
		it("should POST to /login/start without bypass header if not present in sessionStorage", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ success: true, new_user: false }),
			} as Response);

			const response = await provider.startFlow("+493023125123");

			expect(fetch).toHaveBeenCalledWith(
				"/auth-proxy/login/start",
				expect.objectContaining({
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ phone_number: "+493023125123" }),
				}),
			);
			expect(response.success).toBe(true);
		});

		it("should POST to /login/start with X-BeyondForms-Prod-Test-Key header if present in sessionStorage", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ success: true, new_user: false }),
			} as Response);

			window.sessionStorage.setItem("bf_bypass_key", "test-bypass-key-123");

			const response = await provider.startFlow("+493023125123");

			expect(fetch).toHaveBeenCalledWith(
				"/auth-proxy/login/start",
				expect.objectContaining({
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-BeyondForms-Prod-Test-Key": "test-bypass-key-123",
					},
					body: JSON.stringify({ phone_number: "+493023125123" }),
				}),
			);
			expect(response.success).toBe(true);
		});
	});
});
