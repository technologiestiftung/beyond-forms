import React from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LOCALE } from "../../constants/locale";
import type { AuthStatus } from "../../store/useAuthStore";

interface AuthLoadingProps {
	authStatus: AuthStatus;
}

export const AuthLoading: React.FC<AuthLoadingProps> = ({
	authStatus,
}: AuthLoadingProps) => {
	const { t, i18n } = useTranslation("auth");

	const isDe = i18n.language === DEFAULT_LOCALE;

	let displayText = "Loading...";
	switch (authStatus) {
		case "VERIFYING_USERNAME":
			if (isDe) {
				displayText = t("phone_verifying", "Telefonnummer wird überprüft...");
			} else {
				displayText = t("phone_verifying", "Phone number is being verified...");
			}
			break;
		case "VERIFYING_CODE":
			if (isDe) {
				displayText = t("code_verifying", "Code wird überprüft...");
			} else {
				displayText = t("code_verifying", "Code is being verified...");
			}
			break;
		default:
			if (isDe) {
				displayText = t("sync.loading_profile", "Dein Profil wird geladen...");
			} else {
				displayText = t("sync.loading_profile", "Loading your profile...");
			}
	}

	return (
		<div
			className="flex flex-col items-center justify-center p-12 space-y-4 max-w-sm w-full"
			data-testid="auth-loading"
		>
			<div className="size-12 border-4 border-brand-black/30 border-t-brand-black rounded-full animate-spin" />
			<p className="text-brand-carbon font-bold animate-pulse text-body-lg text-center">
				{displayText}
			</p>
		</div>
	);
};
