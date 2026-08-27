import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
// import { matchPath } from "react-router-dom"; // disabled: tutorial gate commented out below
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/useAuthStore";
import { useTutorialStore } from "../../store/useTutorialStore";
import { AppRoutes } from "../../constants/routes";
// import { ONBOARDING_TUTORIAL_SLUGS } from "../../constants/onboardingTutorials"; // disabled: tutorial gate commented out below

interface ProtectedRouteProps {
	children: React.ReactNode;
}

/**
 * ProtectedRoute redirects unauthenticated users to the Auth screen,
 * initializes onboarding stores, and acts as the single source of truth
 * for the mandatory onboarding technical guide redirection.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
	const { t } = useTranslation("common");
	const { token } = useAuthStore();
	const { tutorials, initialized, isLoading, fetchTutorials } =
		useTutorialStore();
	const location = useLocation();

	// Synchronously trigger onboarding metadata fetch exactly once per session
	useEffect(() => {
		if (token && !initialized && !isLoading) {
			void fetchTutorials();
		}
	}, [token, initialized, isLoading, fetchTutorials]);

	if (!token) {
		return (
			<Navigate
				to={`${AppRoutes.Auth}${location.search}`}
				state={{ from: location }}
				replace
			/>
		);
	}

	// Render fullscreen loader until the stores are successfully initialized (non-blocking cache fallback)
	if (!initialized && tutorials.length === 0) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-brand-bg">
				<h1 className="sr-only">{t("loading_app")}</h1>
				<div className="size-12 border-4 border-brand-black/30 border-t-brand-black rounded-full animate-spin" />
			</main>
		);
	}

	// DISABLED: Mandatory tutorial gate. To re-enable, uncomment the code below and restore
	// matchPath and ONBOARDING_TUTORIAL_SLUGS imports at the top of this file.
	/*
	// Clean, param-based route path matching
	const match = matchPath(
		{ path: AppRoutes.TutorialViewer, end: true },
		location.pathname,
	);
	const isCurrentlyOnMandatoryTutorial =
		match?.params.slug === ONBOARDING_TUTORIAL_SLUGS.appGuide;

	if (isCurrentlyOnMandatoryTutorial) {
		return <>{children}</>;
	}

	// Enforce onboarding technical guide completion status with loop protection
	const appGuide = tutorials.find(
		(tut) => tut.slug === ONBOARDING_TUTORIAL_SLUGS.appGuide,
	);
	const isAppGuideValid =
		appGuide && appGuide.steps && appGuide.steps.length > 0;
	const appGuideCompleted = appGuide?.progress.status === "completed";

	if (!appGuideCompleted && isAppGuideValid) {
		return (
			<Navigate
				to={AppRoutes.TutorialViewer.replace(
					":slug",
					ONBOARDING_TUTORIAL_SLUGS.appGuide,
				)}
				replace
			/>
		);
	}
	*/

	return <>{children}</>;
};
