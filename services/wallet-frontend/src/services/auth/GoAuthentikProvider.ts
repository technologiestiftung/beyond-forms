import type { IAuthProvider, AuthResponse } from "./IAuthProvider";
import type { PhoneNumber, OTP } from "../../schemas/auth.schema";
import { env } from "../../config/env.config";

export class GoAuthentikProvider implements IAuthProvider {
	private baseUrl = env.VITE_AUTH_URL;

	async startFlow(phone: PhoneNumber): Promise<AuthResponse> {
		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			const bypassKey = sessionStorage.getItem("bf_bypass_key");
			if (bypassKey) {
				headers["X-BeyondForms-Prod-Test-Key"] = bypassKey;
			}

			const response = await fetch(`${this.baseUrl}/login/start`, {
				method: "POST",
				headers,
				body: JSON.stringify({ phone_number: phone }),
				credentials: "include",
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return {
					success: false,
					errorCode: "AUTH_ERROR",
					error: errorData.detail || "error.unknown",
				};
			}

			const data = await response.json();

			// Save token and flow hint in sessionStorage to bypass Third-Party Cookie blocking
			if (data.token) {
				sessionStorage.setItem("bf_auth_token", data.token);
			}
			if (data.flow) {
				sessionStorage.setItem("bf_auth_flow", data.flow);
			}

			return { success: true, isNewUser: data.new_user };
		} catch (e: unknown) {
			return {
				success: false,
				errorCode: "NETWORK_ERROR",
				error: e instanceof Error ? e.message : "error.network",
			};
		}
	}

	async verifyOtp(_phone: PhoneNumber, code: OTP): Promise<AuthResponse> {
		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};

			const storedToken = sessionStorage.getItem("bf_auth_token");
			const storedFlow = sessionStorage.getItem("bf_auth_flow");

			if (storedToken) {
				headers["Authorization"] = `Bearer ${storedToken}`;
			}
			if (storedFlow) {
				headers["X-BeyondForms-Auth-Flow"] = storedFlow;
			}

			const response = await fetch(`${this.baseUrl}/login/finish`, {
				method: "POST",
				headers,
				body: JSON.stringify({ code }),
				credentials: "include",
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return {
					success: false,
					errorCode: "VERIFY_ERROR",
					error: errorData.detail || "error.unknown",
				};
			}

			const data = await response.json();

			// Clean up storage after success
			sessionStorage.removeItem("bf_auth_token");
			sessionStorage.removeItem("bf_auth_flow");

			return {
				success: data.success,
				isNewUser: data.is_new_user,
				token: data.token,
			};
		} catch (e: unknown) {
			return {
				success: false,
				errorCode: "NETWORK_ERROR",
				error: e instanceof Error ? e.message : "error.network",
			};
		}
	}

	async resendOtp(phone: PhoneNumber): Promise<AuthResponse> {
		// Resend OTP usually re-triggers the log/start flow or has its own endpoint.
		// In our case, login-start handles both login and enrollment and sends SMS.
		// So we can just call startFlow again!
		return this.startFlow(phone);
	}

	async logout(): Promise<void> {
		try {
			await fetch(`${this.baseUrl}/logout`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
			});
		} catch (_e) {
			// Silently fail if offline so the user can still logout locally
		}
	}

	async verifySession(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/verify_auth`, {
				method: "GET",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
			});
			if (!response.ok) {
				return false;
			}
			const data = await response.json();
			return !!data.is_authenticated;
		} catch (_e) {
			return false;
		}
	}
}
