import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore, type AuthStatus } from "../store/useAuthStore";
import { useEligibilityStore } from "../store/useEligibilityStore";
import { applicationService } from "../services/application.service";
import { PhoneNumberForm } from "../components/Auth/PhoneNumberForm";
import { OTPForm } from "../components/Auth/OTPForm";
import { PersonaPicker } from "../components/Auth/PersonaPicker";
import { RegistrationSuccess } from "../components/Auth/RegistrationSuccess";
import { PageContainer } from "../components/Layout/PageContainer";
import { AppRoutes, URL_PARAMS } from "../constants/routes";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AlertCircle, X } from "lucide-react";
import { AuthLoading } from "./Auth/AuthLoading";
import { useScrollToTop } from "../utils/scroll";

export const AuthView: React.FC = () => {
	const { t } = useTranslation("auth");
	const navigate = useNavigate();
	const shouldReduceMotion = useReducedMotion();
	const [searchParams] = useSearchParams();

	const status: AuthStatus = useAuthStore((s) => s.status);
	const currentPhoneNumber = useAuthStore((s) => s.phoneNumber);
	const answers = useEligibilityStore((s) => s.answers);
	// Defaults to true if a phone number is already set on mount (e.g. after a
	// page reload mid manual entry) so that state isn't stranded behind the
	// picker; a fresh session always starts at the picker.
	const [manualFlow, setManualFlow] = useState(
		() => !!useAuthStore.getState().phoneNumber,
	);

	const origin = searchParams.get(URL_PARAMS.ORIGIN);
	const mode = searchParams.get("mode");

	const logout = useAuthStore((s) => s.logout);

	useEffect(() => {
		if (mode === "login") {
			logout();
		}
	}, [mode, logout]);

	const {
		mutate: syncData,
		isPending: isSyncing,
		error: syncMutationError,
		reset: resetSyncError,
	} = useMutation({
		mutationFn: async (data: typeof answers) => {
			const result = await applicationService.syncGuestData(data);
			if (!result.success) {
				throw new Error(result.message || t("sync.error_failed"));
			}
			return result;
		},
		onSuccess: () => {
			// Auto-navigate only per returning user explicitly so new users see the RegistrationSuccess stepper.
			if (useAuthStore.getState().status === "SUCCESS_RETURNING") {
				void navigate(AppRoutes.Dashboard);
			}
		},
	});

	const isNewUser = status === "SUCCESS_NEW";
	const isReturningUser = status === "SUCCESS_RETURNING";

	const hasSyncedRef = useRef(false);

	// 2. Handle Auto-Redirect & Data Sync for authenticated users
	// Ensure eligibility answers are synchronized precisely once to guard against infinite loops.
	useEffect(() => {
		if ((isReturningUser || isNewUser) && !isSyncing && !hasSyncedRef.current) {
			if (
				origin === URL_PARAMS.ORIGIN_ELIGIBILITY &&
				Object.keys(answers).length > 0
			) {
				hasSyncedRef.current = true;
				syncData(answers);
			} else if (isReturningUser) {
				void navigate(AppRoutes.Dashboard);
			}
		}
	}, [
		isReturningUser,
		isNewUser,
		isSyncing,
		navigate,
		answers,
		origin,
		syncData,
	]);

	// Reset scrolling when status changes since it renders different page content.
	useScrollToTop(status);

	const handleAuthSuccess = useCallback((newUser: boolean) => {
		// If it's a returning user, the useEffect above will handle the navigation/sync
		// If it's a new user, they will stay on this view to see the RegistrationSuccess component
		if (!newUser) {
			// Returning user logic is handled by the side-effect watching 'isReturningUser'
		}
	}, []);

	const handleRegistrationComplete = useCallback(() => {
		void navigate(AppRoutes.Dashboard);
	}, [navigate]);

	const handleCancelOrBack = () => {
		if (status === "IDLE" || status === "ERROR") {
			// Manual phone entry, not mid-OTP: just return to the persona picker.
			setManualFlow(false);
			return;
		}
		useAuthStore.getState().logout();
	};

	const syncError = syncMutationError
		? (syncMutationError as Error).message || t("sync.error_failed")
		: null;

	const renderContent = () => {
		// Case 1: Just successfully registered -> Show Welcome/Success
		if (isNewUser) {
			return <RegistrationSuccess onComplete={handleRegistrationComplete} />;
		}

		// Case 2: Returning user (logging in or already logged in) -> Show Loading while we redirect/sync
		if (isReturningUser) {
			return <AuthLoading authStatus={status} />;
		}

		// Case 3: Standard Auth States (IDLE, VERIFYING code, or ERROR)
		switch (status) {
			case "VERIFYING_USERNAME":
			case "VERIFYING_CODE":
				return <AuthLoading authStatus={status} />;
			case "AWAITING_OTP":
				// An instant persona login also passes through AWAITING_OTP briefly;
				// only show the OTP form for the manual phone-entry flow.
				return manualFlow ? (
					<OTPForm onSuccess={handleAuthSuccess} />
				) : (
					<AuthLoading authStatus={status} />
				);
			case "IDLE":
			case "ERROR":
				if (currentPhoneNumber) {
					return <OTPForm onSuccess={handleAuthSuccess} />;
				}
				return manualFlow ? (
					<PhoneNumberForm />
				) : (
					<PersonaPicker onUsePhoneNumber={() => setManualFlow(true)} />
				);
			default:
				return <PersonaPicker onUsePhoneNumber={() => setManualFlow(true)} />;
		}
	};

	return (
		<PageContainer
			maxWidth="md"
			topBarProps={{
				onBack:
					status === "AWAITING_OTP" ||
					((status === "IDLE" || status === "ERROR") &&
						manualFlow &&
						!currentPhoneNumber)
						? handleCancelOrBack
						: undefined,
				showLanguageSwitcher: true,
			}}
			data-testid="auth-view"
		>
			<AnimatePresence mode="wait">
				<motion.div
					key={status + (isSyncing ? "-syncing" : "")}
					initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
					transition={{ duration: 0.3 }}
					className="w-full flex justify-center"
				>
					{isSyncing ? (
						<div
							className="flex flex-col items-center justify-center p-12 space-y-6 text-center max-w-sm w-full"
							data-testid="sync-loading"
						>
							<div className="size-16 border-4 border-brand-black/30 border-t-brand-black rounded-full animate-spin" />
							<div className="flex flex-col gap-3">
								<h2 className="text-h1 font-bold text-brand-carbon m-0 p-0">
									{t("sync.title")}
								</h2>
								<p className="text-body-lg text-brand-black m-0 p-0 font-medium">
									{t("sync.desc")}
								</p>
							</div>
						</div>
					) : (
						renderContent()
					)}
				</motion.div>
			</AnimatePresence>

			<AnimatePresence>
				{syncError && (
					<motion.div
						initial={{ opacity: 0, y: 100 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 100 }}
						data-testid="sync-error-toast"
						className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-md bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 z-toast"
					>
						<AlertCircle className="size-6 shrink-0" />
						<div className="flex-1">
							<p className="font-bold text-sm">{t("sync.error_title")}</p>
							<p className="text-xs font-medium">{syncError}</p>
						</div>
						<button
							onClick={() => {
								resetSyncError();
								void navigate(AppRoutes.Dashboard);
							}}
							className="p-1 hover:bg-white/10 rounded-lg cursor-pointer"
							data-testid="sync-error-close"
							aria-label={t("close_error_message")}
						>
							<X className="size-5" />
						</button>
					</motion.div>
				)}
			</AnimatePresence>
		</PageContainer>
	);
};
