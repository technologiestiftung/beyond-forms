import React from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/useAuthStore";
import { useProfileStore } from "../../store/useProfileStore";

interface ErrorFallbackProps {
	resetStrategy?: "full" | "reload";
}

/**
 * A functional component for rendering the error fallback UI.
 * This allows using hooks like useTranslation and useAuthStore.
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
	resetStrategy,
}) => {
	const { t } = useTranslation("common");
	const logout = useAuthStore((s) => s.logout);
	const resetProfile = useProfileStore((s) => s.reset);

	const handleReset = () => {
		if (resetStrategy === "reload") {
			window.location.reload();
		} else {
			// Surgical reset: Clear critical state and redirect
			logout();
			resetProfile();
			window.location.href = "/";
		}
	};

	return (
		<main className="min-h-screen flex items-center justify-center bg-brand-muted p-6">
			<div className="max-w-md w-full bg-white rounded-xl p-8 shadow-xl text-center">
				<h1 className="text-2xl font-bold text-brand-black mb-4">
					{t("error.generic_title")}
				</h1>
				<p className="text-brand-black mb-8">{t("error.generic_desc")}</p>
				<button
					onClick={handleReset}
					className="w-full h-14 bg-brand-primary text-white text-lg font-bold rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
				>
					{resetStrategy === "reload"
						? t("error.reload_button")
						: t("error.back_to_home")}
				</button>
			</div>
		</main>
	);
};
