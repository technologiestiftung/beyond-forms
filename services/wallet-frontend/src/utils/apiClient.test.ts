import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { authenticatedFetch } from "./apiClient";
import { useAuthStore } from "../store/useAuthStore";

// Mock window.location
const mockReplace = vi.fn();
Object.defineProperty(window, "location", {
	value: { replace: mockReplace },
	writable: true,
});

describe("authenticatedFetch (Security Interceptor)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useAuthStore.setState({
			token: "valid-test-token",
			status: "SUCCESS_RETURNING",
		});
		globalThis.fetch = vi.fn();
	});

	it("should inject Authorization header when token is present", async () => {
		(globalThis.fetch as Mock).mockResolvedValue({
			status: 200,
			ok: true,
			json: () => Promise.resolve({ data: "ok" }),
		});

		await authenticatedFetch("https://api.example.com/data");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"https://api.example.com/data",
			expect.objectContaining({
				headers: expect.any(Headers),
			}),
		);

		const headers = (globalThis.fetch as Mock).mock.calls[0][1]
			.headers as Headers;
		expect(headers.get("Authorization")).toBe("Bearer valid-test-token");
	});

	it("should trigger logout and redirect on 401 status", async () => {
		(globalThis.fetch as Mock).mockResolvedValue({
			status: 401,
			ok: false,
			statusText: "Unauthorized",
		});

		// Spy on logout
		const logoutSpy = vi.spyOn(useAuthStore.getState(), "logout");

		await authenticatedFetch("https://api.example.com/secure-data");

		// 1. Verify logout was called
		expect(logoutSpy).toHaveBeenCalled();

		// 2. Verify state was wiped (via check of store after logout)
		expect(useAuthStore.getState().token).toBeNull();
		expect(useAuthStore.getState().status).toBe("IDLE");

		// 3. Verify no hard redirect happened
		expect(mockReplace).not.toHaveBeenCalled();
	});

	it("should return response as-is for non-401 errors", async () => {
		(globalThis.fetch as Mock).mockResolvedValue({
			status: 500,
			ok: false,
			statusText: "Internal Server Error",
		});

		const response = await authenticatedFetch("https://api.example.com/broken");

		expect(response.status).toBe(500);
		expect(mockReplace).not.toHaveBeenCalled();
	});
});
