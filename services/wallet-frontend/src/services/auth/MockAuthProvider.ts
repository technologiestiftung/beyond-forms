import type { IAuthProvider, AuthResponse } from "./IAuthProvider";
import type { PhoneNumber, OTP } from "../../schemas/auth.schema";

export class MockAuthProvider implements IAuthProvider {
	private simulateDelay(): Promise<void> {
		const delay = Math.floor(Math.random() * 300) + 200;
		return new Promise((resolve) => setTimeout(resolve, delay));
	}

	async startFlow(_phone: PhoneNumber): Promise<AuthResponse> {
		await this.simulateDelay();
		return { success: true };
	}

	private profileExists(phone: string): boolean {
		const cleanPhone = phone
			.replace(/^\+49/, "")
			.replace(/^49/, "")
			.replace(/\D/g, "");
		const keys = [
			`beyond-forms-mock-profile-${cleanPhone}`,
			`beyond-forms-mock-profile-+49${cleanPhone}`,
			`beyond-forms-mock-profile-default`,
		];
		return keys.some((key) => {
			const item = localStorage.getItem(key);
			if (item) {
				try {
					const parsed = JSON.parse(item);
					return parsed && Object.keys(parsed).length > 0;
				} catch (_e) {
					return false;
				}
			}
			return false;
		});
	}

	async verifyOtp(phone: PhoneNumber, code: OTP): Promise<AuthResponse> {
		await this.simulateDelay();

		// Support German Drama Numbers (Test Accounts) in the Mock
		// Any code works for these prefixes, consistent with backend behavior.
		const isDramaNumber = [
			"+493023125", // Berlin
			"+496990009", // Frankfurt
			"+494066969", // Hamburg
			"+492214710", // Köln
			"+498999998", // München
		].some((prefix) => phone.startsWith(prefix));

		if (isDramaNumber) {
			const registered = this.profileExists(phone);
			return {
				success: true,
				token: `mock-jwt-token-${!registered ? "new" : "returning"}-user`,
				isNewUser: !registered,
			};
		}

		if (code === "111111") {
			return {
				success: true,
				token: "mock-jwt-token-new-user",
				isNewUser: true,
			};
		}

		if (code === "222222") {
			return {
				success: true,
				token: "mock-jwt-token-returning-user",
				isNewUser: false,
			};
		}

		if (code === "555555") {
			return {
				success: true,
				token: "mock-jwt-token-simulate-500",
				isNewUser: true,
			};
		}

		if (code === "999999") {
			return {
				success: false,
				errorCode: "RATE_LIMIT_EXCEEDED",
				error: "error.rate_limit_exceeded",
			};
		}

		if (code !== "000000") {
			return {
				success: true,
				token: `mock-jwt-token-${phone.endsWith("1") ? "new" : "returning"}-user`,
				isNewUser: phone.endsWith("1"),
			};
		}

		return {
			success: false,
			errorCode: "INVALID_OTP",
			error: "error.invalid_otp",
		};
	}

	async resendOtp(_phone: PhoneNumber): Promise<AuthResponse> {
		await this.simulateDelay();
		return { success: true };
	}

	async logout(): Promise<void> {
		await this.simulateDelay();
	}

	async verifySession(): Promise<boolean> {
		await this.simulateDelay();
		return true;
	}
}
