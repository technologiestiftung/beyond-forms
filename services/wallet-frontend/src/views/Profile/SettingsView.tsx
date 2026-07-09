import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, LogOut, Trash2 } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { PageContainer } from "../../components/Layout/PageContainer";
import { useAuthStore } from "../../store/useAuthStore";
import { useProfileStore } from "../../store/useProfileStore";
import { profileService } from "../../services/profile";

export const SettingsView: React.FC = () => {
	const navigate = useNavigate();
	const { t } = useTranslation("profile");

	const logout = useAuthStore((s) => s.logout);
	const resetProfileStore = useProfileStore((s) => s.reset);

	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleCancelOrBack = () => {
		navigate(AppRoutes.Profile);
	};

	const clearSessionAndStorage = () => {
		const keysToPurge = [
			"beyond-forms-profile-ui",
			"beyond-forms-preferences",
			"beyond-forms-chat",
			"beyond-forms-tutorial-session",
			"beyond-forms-auth-session",
			"beyond-forms-wallet-session",
		];
		keysToPurge.forEach((key) => {
			localStorage.removeItem(key);
			sessionStorage.removeItem(key);
		});
	};

	const handleDeepLogout = async () => {
		try {
			resetProfileStore();
			await logout();
		} catch (e) {
			console.error("Deep logout failed:", e);
		}
		clearSessionAndStorage();
		navigate(AppRoutes.Home);
	};

	const handleDeepDeleteAccount = async () => {
		setIsDeleting(true);
		setDeleteError(null);
		try {
			await profileService.deleteProfile();
			resetProfileStore();
			await logout();
			clearSessionAndStorage();
			setShowDeleteModal(false);
			navigate(AppRoutes.Home);
		} catch (e) {
			console.error("Deep delete account failed:", e);
			setDeleteError(
				t(
					"settings.modals.delete.error",
					"Fehler beim Löschen des Kontos. Bitte versuche es später noch einmal.",
				),
			);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<PageContainer
			topBarProps={{
				onBack: () => handleCancelOrBack(),
				middleElement: (
					<span className="text-sm font-extrabold text-slate-800 tracking-wide uppercase truncate">
						{t("settings.title", "Einstellungen")}
					</span>
				),
				rightElement: (
					<button
						type="button"
						onClick={handleCancelOrBack}
						aria-label={t("common.close", "Schließen")}
						className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-100 active:scale-90 transition-all"
					>
						<X className="w-5 h-5 text-slate-700" />
					</button>
				),
				showLanguageSwitcher: true,
			}}
		>
			<div className="w-full max-w-md text-center mb-6">
				<h1 className="text-2xl font-extrabold text-slate-900">
					{t("settings.title", "Einstellungen")}
				</h1>
			</div>

			{/* Stacked Action Buttons at bottom */}
			<div className="flex flex-col gap-3 w-full max-w-md">
				<button
					type="button"
					onClick={handleDeepLogout}
					className="w-full h-14 bg-white border border-slate-200 text-slate-800 font-bold text-base rounded-2xl shadow-sm flex items-center px-5 justify-between hover:bg-slate-50 active:scale-98 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all"
				>
					<div className="flex items-center space-x-3">
						<LogOut className="w-5 h-5 text-slate-500" />
						<span>{t("actions.logout", "Bei Klaro ausloggen")}</span>
					</div>
				</button>

				<button
					type="button"
					onClick={() => setShowDeleteModal(true)}
					className="w-full h-14 bg-white border border-red-100 text-red-600 font-bold text-base rounded-2xl shadow-sm flex items-center px-5 justify-between hover:bg-red-50/30 active:scale-98 focus:outline-none focus:ring-4 focus:ring-red-100 transition-all"
				>
					<div className="flex items-center space-x-3">
						<Trash2 className="w-5 h-5 text-red-500" />
						<span>
							{t("actions.delete_account", "Mein Klaro Konto löschen")}
						</span>
					</div>
				</button>
			</div>

			{/* MODAL: Delete Account Confirmation */}
			{showDeleteModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 px-4">
					<div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl flex flex-col gap-4 text-left border border-slate-100">
						<div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
							<Trash2 className="w-6 h-6" />
						</div>
						<div>
							<h3 className="text-lg font-extrabold text-slate-900">
								{t(
									"settings.modals.delete.title",
									"Konto unwiderruflich löschen?",
								)}
							</h3>
							<p className="text-sm text-slate-500 mt-1">
								{t(
									"settings.modals.delete.desc",
									"Bist Du sicher, dass Du Dein Konto löschen möchtest? Alle Deine persönlichen Daten und Dokumente werden sofort und unwiderruflich vom Gerät entfernt.",
								)}
							</p>
						</div>

						{deleteError && (
							<div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
								{deleteError}
							</div>
						)}

						<div className="flex gap-3 mt-2">
							<button
								type="button"
								onClick={handleDeepDeleteAccount}
								disabled={isDeleting}
								className="flex-1 h-12 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
							>
								{isDeleting
									? t("common.loading", "Laden...")
									: t("settings.modals.delete.confirm", "Konto löschen")}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowDeleteModal(false);
									setDeleteError(null);
								}}
								disabled={isDeleting}
								className="flex-1 h-12 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
							>
								{t("settings.modals.delete.cancel", "Abbrechen")}
							</button>
						</div>
					</div>
				</div>
			)}
		</PageContainer>
	);
};
