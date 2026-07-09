import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "./useAuthStore";
import type { PhoneNumber, OTP } from "../schemas/auth.schema";

vi.mock("../config/env.config", () => ({
	env: {
		VITE_USE_MOCK_AUTH: true,
	},
}));

describe("useAuthStore (Sandor Resilience Audit)", () => {
	beforeEach(() => {
		useAuthStore.getState().logout();
		sessionStorage.clear();
	});

	it("should transition from IDLE to AWAITING_OTP on successful login flow", async () => {
		const phone = "+4917612345678" as PhoneNumber;
		const loginPromise = useAuthStore.getState().login(phone);
		expect(useAuthStore.getState().status).toBe("VERIFYING_USERNAME");
		await loginPromise;
		expect(useAuthStore.getState().status).toBe("AWAITING_OTP");
		expect(useAuthStore.getState().phoneNumber).toBe(phone);
	});

	it("should transition to SUCCESS_NEW for new users (OTP 111111)", async () => {
		const { login, verify } = useAuthStore.getState();
		await login("+4917611111111" as PhoneNumber);
		const otpPromise = verify("111111" as OTP);
		expect(useAuthStore.getState().status).toBe("VERIFYING_CODE");
		await otpPromise;
		expect(useAuthStore.getState().status).toBe("SUCCESS_NEW");
		expect(useAuthStore.getState().token).toBe("mock-jwt-token-new-user");
	});

	it("should transition to SUCCESS_RETURNING for existing users (OTP 222222)", async () => {
		const { login, verify } = useAuthStore.getState();
		await login("+4917622222222" as PhoneNumber);
		await verify("222222" as OTP);
		expect(useAuthStore.getState().status).toBe("SUCCESS_RETURNING");
		expect(useAuthStore.getState().token).toBe("mock-jwt-token-returning-user");
	});

	it("should transition to SUCCESS_RETURNING for standard mobile numbers with standard OTP", async () => {
		const { login, verify } = useAuthStore.getState();
		await login("+4917612345672" as PhoneNumber);
		await verify("123456" as OTP);
		expect(useAuthStore.getState().status).toBe("SUCCESS_RETURNING");
		expect(useAuthStore.getState().token).toBe("mock-jwt-token-returning-user");
	});

	it("should handle rate limits (OTP 999999)", async () => {
		const { login, verify } = useAuthStore.getState();
		await login("+4917699999999" as PhoneNumber);
		await verify("999999" as OTP);
		expect(useAuthStore.getState().status).toBe("ERROR");
		expect(useAuthStore.getState().errorCode).toBe("RATE_LIMIT_EXCEEDED");
	});

	it("should handle invalid codes (OTP 000000)", async () => {
		const { login, verify } = useAuthStore.getState();
		await login("+4917600000000" as PhoneNumber);
		await verify("000000" as OTP);
		expect(useAuthStore.getState().status).toBe("ERROR");
		expect(useAuthStore.getState().errorCode).toBe("INVALID_OTP");
	});
});
