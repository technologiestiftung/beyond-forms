import type { PhoneNumber, OTP } from "../../schemas/auth.schema";

export interface AuthResponse {
	success: boolean;
	token?: string;
	isNewUser?: boolean;
	error?: string;
	errorCode?: string;
}

export interface IAuthProvider {
	/**
	 * Starts the authentication flow (send OTP).
	 */
	startFlow(phone: PhoneNumber): Promise<AuthResponse>;

	/**
	 * Verifies the OTP code and returns a session token.
	 */
	verifyOtp(phone: PhoneNumber, code: OTP): Promise<AuthResponse>;

	/**
	 * Resends the OTP code.
	 */
	resendOtp(phone: PhoneNumber): Promise<AuthResponse>;

	/**
	 * Logs out and clears the remote session.
	 */
	logout(): Promise<void>;

	/**
	 * Verifies the validity of the remote session.
	 */
	verifySession(): Promise<boolean>;
}
