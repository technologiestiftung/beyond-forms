import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, LogOut, Trash2 } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { PageContainer } from "../../components/Layout/PageContainer";
import { useAuthStore } from "../../store/useAuthStore";
import { useProfileStore } from "../../store/useProfileStore";
import { profileService } from "../../services/profile";
import { useLogout, clearSessionAndStorage } from "../../hooks/useLogout";
import { useIsDesktop } from "../../hooks/useIsDesktop";

export const SettingsView: React.FC = () => {
	const navigate = useNavigate();
	const { t } = useTranslation("profile");

	const logout = useAuthStore((s) => s.logout);
	const phoneNumber = useAuthStore((s) => s.phoneNumber);
	const resetProfileStore = useProfileStore((s) => s.reset);
	const handleLogout = useLogout();
	const isDesktop = useIsDesktop();

	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleCancelOrBack = () => {
		navigate(AppRoutes.Profile);
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
				rightElement: (
					<button
						type="button"
						onClick={handleCancelOrBack}
						aria-label={t("common.close", "Schließen")}
						className="w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-100 active:scale-90 transition-all"
					>
						<X className="w-5 h-5 text-slate-700" />
					</button>
				),
				showLanguageSwitcher: true,
				className: "lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pt-4",
			}}
			contentClassName="lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pb-16"
		>
			{isDesktop ? (
				<div className="w-full max-w-[660px] flex flex-col gap-5">
					<div className="flex flex-col gap-2">
						<h1 className="text-[32px] leading-10 font-bold text-brand-black">
							{t("settings.title", "Einstellungen")}
						</h1>
						<p className="text-body-lg text-brand-grey">
							{t(
								"settings.subtitle",
								"Hier verwaltest Du Deinen Zugang zu Klaro.",
							)}
						</p>
					</div>

					{phoneNumber && (
						<div className="bg-white rounded-2xl border border-brand-border-subtle shadow-cards p-7 flex flex-col gap-1.5">
							<p className="text-xs font-bold text-primary-blue-300 uppercase tracking-wide">
								{t("settings.account.phone_label", "Deine Anmeldenummer")}
							</p>
							<p
								className="text-[26px] leading-9 font-bold text-brand-black"
								data-testid="settings-phone-number"
							>
								{phoneNumber}
							</p>
							<p className="text-[15px] text-primary-blue-300">
								{t(
									"settings.account.phone_hint",
									"Merke Dir diese Nummer, um Dich später wieder anzumelden.",
								)}
							</p>
						</div>
					)}

					<button
						type="button"
						onClick={() => void handleLogout()}
						data-testid="logout-trigger"
						className="w-full bg-white rounded-2xl border border-brand-border-subtle shadow-cards px-7 py-5 flex items-center gap-3.5 text-left cursor-pointer hover:bg-brand-bg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue-500"
					>
						<LogOut className="size-6 text-primary-blue-500" />
						<span className="text-body-lg font-bold text-brand-black">
							{t("actions.logout", "Bei Klaro ausloggen")}
						</span>
					</button>

					<div className="bg-red-50 border-[1.5px] border-red-600 rounded-2xl p-7 flex flex-col gap-3.5">
						<h2 className="text-body-lg font-bold text-red-600">
							{t("actions.delete_account", "Mein Klaro Konto löschen")}
						</h2>
						<p className="text-[15px] text-brand-black">
							{t(
								"settings.account.delete_hint",
								"Alle Deine Angaben und hochgeladenen Dokumente werden dauerhaft gelöscht. Laufende Anträge kannst Du danach nicht mehr einsehen. Das lässt sich nicht rückgängig machen.",
							)}
						</p>
						<button
							type="button"
							onClick={() => setShowDeleteModal(true)}
							data-testid="delete-account-trigger"
							className="self-start border-2 border-red-600 text-red-600 font-medium rounded-full px-5.5 py-2.5 cursor-pointer hover:bg-red-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
						>
							{t("actions.delete_account", "Mein Klaro Konto löschen")}
						</button>
					</div>
				</div>
			) : (
				<>
					<div className="w-full max-w-md text-center mb-6">
						<h1 className="text-2xl font-extrabold text-slate-900">
							{t("settings.title", "Einstellungen")}
						</h1>
					</div>

					{phoneNumber && (
						<div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-4 mb-4">
							<p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
								{t("settings.account.phone_label", "Deine Anmeldenummer")}
							</p>
							<p
								className="text-base font-bold text-slate-900"
								data-testid="settings-phone-number"
							>
								{phoneNumber}
							</p>
							<p className="text-xs text-slate-500 mt-1">
								{t(
									"settings.account.phone_hint",
									"Merke Dir diese Nummer, um Dich später wieder anzumelden.",
								)}
							</p>
						</div>
					)}

					<div className="flex flex-col gap-3 w-full max-w-md">
						<button
							type="button"
							onClick={() => void handleLogout()}
							data-testid="logout-trigger"
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
							data-testid="delete-account-trigger"
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
				</>
			)}

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
