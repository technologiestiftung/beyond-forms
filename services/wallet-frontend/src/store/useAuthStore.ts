import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createZustandStorage } from "../utils/storage";
import { MockAuthProvider } from "../services/auth/MockAuthProvider";
import { GoAuthentikProvider } from "../services/auth/GoAuthentikProvider";
import type { IAuthProvider } from "../services/auth/IAuthProvider";
import type { PhoneNumber, OTP } from "../schemas/auth.schema";
import { env } from "../config/env.config";
import { queryClient } from "../config/queryClient";

export type AuthStatus =
	| "IDLE"
	| "VERIFYING_USERNAME"
	| "AWAITING_OTP"
	| "VERIFYING_CODE"
	| "SUCCESS_NEW"
	| "SUCCESS_RETURNING"
	| "ERROR";

interface AuthState {
	status: AuthStatus;
	phoneNumber: PhoneNumber | null;
	token: string | null;
	error: string | null;
	errorCode: string | null;

	login: (phone: PhoneNumber) => Promise<void>;
	verify: (
		code: OTP,
		options?: { onSuccess?: (isNewUser: boolean) => void },
	) => Promise<void>;
	resend: () => Promise<void>;
	logout: () => Promise<void>;
	clearError: () => void;
}

const authProvider: IAuthProvider = env.VITE_USE_MOCK_AUTH
	? new MockAuthProvider()
	: new GoAuthentikProvider();

export const useAuthStore = create<AuthState>()(
	persist(
		(set, get) => ({
			status: "IDLE",
			phoneNumber: null,
			token: null,
			error: null,
			errorCode: null,

			login: async (phone: PhoneNumber) => {
				set({ status: "VERIFYING_USERNAME", error: null, errorCode: null });
				const response = await authProvider.startFlow(phone);

				if (response.success) {
					set({ status: "AWAITING_OTP", phoneNumber: phone });
				} else {
					set({
						status: "ERROR",
						error: response.error || "error.unknown",
						errorCode: response.errorCode,
					});
				}
			},

			verify: async (code: OTP, options) => {
				const { phoneNumber } = get();
				if (!phoneNumber) {
					return;
				}

				set({ status: "VERIFYING_CODE", error: null, errorCode: null });
				const response = await authProvider.verifyOtp(phoneNumber, code);

				if (response.success) {
					const isNewUser = !!response.isNewUser;
					set({
						status: isNewUser ? "SUCCESS_NEW" : "SUCCESS_RETURNING",
						token: response.token || null,
					});
					options?.onSuccess?.(isNewUser);
				} else {
					set({
						status: "ERROR",
						error: response.error || "error.unknown",
						errorCode: response.errorCode,
					});
				}
			},

			resend: async () => {
				const { phoneNumber } = get();
				if (!phoneNumber) {
					return;
				}

				set({ error: null, errorCode: null });
				const response = await authProvider.resendOtp(phoneNumber);

				if (!response.success) {
					set({
						status: "ERROR",
						error: response.error || "error.unknown",
						errorCode: response.errorCode,
					});
				}
			},

			logout: async () => {
				try {
					await authProvider.logout();
				} catch (e) {
					console.error("Logout request failed:", e);
				}

				queryClient.clear(); // Clear TanStack Query caches on logout

				set({
					status: "IDLE",
					phoneNumber: null,
					token: null,
					error: null,
					errorCode: null,
				});

				// State purification on logout for explicit app stores to prevent leaks
				sessionStorage.removeItem("beyond-forms-tutorial-session");
				sessionStorage.removeItem("beyond-forms-auth-session");
				sessionStorage.removeItem("beyond-forms-wallet-session");
				sessionStorage.removeItem("beyond-forms-chat");
				localStorage.removeItem("beyond-forms-profile-ui");
			},

			clearError: () => set({ error: null, errorCode: null }),
		}),
		{
			name: "beyond-forms-auth-session",
			storage: createJSONStorage(() => createZustandStorage("session")),
			version: 1,
		},
	),
);
