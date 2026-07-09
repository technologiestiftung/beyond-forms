import React, { lazy } from "react";
import { matchPath } from "react-router-dom";
import { AppRoutes } from "../constants/routes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends React.ComponentType<any>>(
	factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
	return lazy(() =>
		factory().catch((error) => {
			const message = error.message || "";
			const name = error.name || "";
			const isChunkError =
				message.includes("Failed to fetch dynamically imported module") ||
				name === "ChunkLoadError";

			if (isChunkError) {
				const retryKey = "chunk_load_retry_failed";
				const hasRetried = sessionStorage.getItem(retryKey);

				if (!hasRetried) {
					sessionStorage.setItem(retryKey, "true");
					console.warn(
						"Dynamic import failed. Reloading page to fetch updated assets...",
						error,
					);

					try {
						const url = new URL(window.location.href);
						url.searchParams.set("t", Date.now().toString());
						window.location.href = url.toString();
					} catch (_) {
						window.location.reload();
					}

					return new Promise(() => {}); // Suppress rendering during redirect
				}
				console.error(
					"Dynamic import failed repeatedly. Rendering error boundary.",
					error,
				);
				sessionStorage.removeItem(retryKey);
			}
			throw error;
		}),
	);
}

const EligibilityStart = lazyWithRetry(() =>
	import("../views/EligibilityStart").then((m) => ({
		default: m.EligibilityStart,
	})),
);
const EligibilityFlow = lazyWithRetry(() =>
	import("../views/EligibilityFlow").then((m) => ({
		default: m.EligibilityFlow,
	})),
);
const EligibilityResult = lazyWithRetry(() =>
	import("../views/EligibilityResult").then((m) => ({
		default: m.EligibilityResult,
	})),
);
const AuthView = lazyWithRetry(() =>
	import("../views/AuthView").then((m) => ({ default: m.AuthView })),
);
const DashboardView = lazyWithRetry(() =>
	import("../views/Dashboard/DashboardView").then((m) => ({
		default: m.DashboardView,
	})),
);
const ApplicationOverview = lazyWithRetry(() =>
	import("../views/Application/ApplicationOverview").then((m) => ({
		default: m.ApplicationOverview,
	})),
);
const TutorialViewer = lazyWithRetry(() =>
	import("../components/Welcome/TutorialViewer").then((m) => ({
		default: m.TutorialViewer,
	})),
);
const ProfileHub = lazyWithRetry(() =>
	import("../views/Profile/ProfileHub").then((m) => ({
		default: m.ProfileHub,
	})),
);
const PersonalDataEdit = lazyWithRetry(() =>
	import("../views/Profile/PersonalDataEdit").then((m) => ({
		default: m.PersonalDataEdit,
	})),
);
const ApplicationHouseholdIntro = lazyWithRetry(() =>
	import("../views/Application/ApplicationHouseholdIntro").then((m) => ({
		default: m.ApplicationHouseholdIntro,
	})),
);
const ApplicationHouseholdQuestions = lazyWithRetry(() =>
	import("../views/Application/ApplicationHouseholdQuestions").then((m) => ({
		default: m.ApplicationHouseholdQuestions,
	})),
);
const ApplicationHousingQuestions = lazyWithRetry(() =>
	import("../views/Application/ApplicationHousingQuestions").then((m) => ({
		default: m.ApplicationHousingQuestions,
	})),
);
const ApplicationHousingIntro = lazyWithRetry(() =>
	import("../views/Application/ApplicationHousingIntro").then((m) => ({
		default: m.ApplicationHousingIntro,
	})),
);
const ApplicationAboutMeIntro = lazyWithRetry(() =>
	import("../views/Application/ApplicationAboutMeIntro").then((m) => ({
		default: m.ApplicationAboutMeIntro,
	})),
);
const ApplicationAboutMeQuestions = lazyWithRetry(() =>
	import("../views/Application/ApplicationAboutMeQuestions").then((m) => ({
		default: m.ApplicationAboutMeQuestions,
	})),
);
const ApplicationIncomeAssetsIntro = lazyWithRetry(() =>
	import("../views/Application/ApplicationIncomeAssetsIntro").then((m) => ({
		default: m.ApplicationIncomeAssetsIntro,
	})),
);
const ApplicationIncomeAssetsQuestions = lazyWithRetry(() =>
	import("../views/Application/ApplicationIncomeAssetsQuestions").then((m) => ({
		default: m.ApplicationIncomeAssetsQuestions,
	})),
);
const ApplicationHealthIntro = lazyWithRetry(() =>
	import("../views/Application/ApplicationHealthIntro").then((m) => ({
		default: m.ApplicationHealthIntro,
	})),
);
const ApplicationHealthQuestions = lazyWithRetry(() =>
	import("../views/Application/ApplicationHealthQuestions").then((m) => ({
		default: m.ApplicationHealthQuestions,
	})),
);
const ApplicationUploadOptions = lazyWithRetry(() =>
	import("../views/Application/ApplicationUploadOptions").then((m) => ({
		default: m.ApplicationUploadOptions,
	})),
);
const DocumentDropzone = lazyWithRetry(() =>
	import("../views/Profile/DocumentDropzone").then((m) => ({
		default: m.DocumentDropzone,
	})),
);

const SettingsView = lazyWithRetry(() =>
	import("../views/Profile/SettingsView").then((m) => ({
		default: m.SettingsView,
	})),
);
const DocumentsOverview = lazyWithRetry(() =>
	import("../views/Profile/DocumentsOverview").then((m) => ({
		default: m.DocumentsOverview,
	})),
);
const DocumentReviewView = lazyWithRetry(() =>
	import("../views/Profile/DocumentReviewView").then((m) => ({
		default: m.DocumentReviewView,
	})),
);
const DocumentReviewSuccessView = lazyWithRetry(() =>
	import("../views/Profile/DocumentReviewSuccessView").then((m) => ({
		default: m.DocumentReviewSuccessView,
	})),
);
const CategoryDocumentsView = lazyWithRetry(() =>
	import("../views/Profile/CategoryDocumentsView").then((m) => ({
		default: m.CategoryDocumentsView,
	})),
);

export interface RouteDescriptor {
	path: string;
	component: React.ComponentType;
	metadata: {
		showNav: boolean;
		layout: "step" | "dashboard" | "none";
		requiresAuth?: boolean;
		titleKey?: string;
	};
}

export const routeConfig: RouteDescriptor[] = [
	{
		path: AppRoutes.Home,
		component: EligibilityStart,
		metadata: {
			showNav: false,
			layout: "step",
		},
	},
	{
		path: AppRoutes.EligibilityCheck,
		component: EligibilityFlow,
		metadata: {
			showNav: false,
			layout: "step",
		},
	},
	{
		path: AppRoutes.EligibilityResult,
		component: EligibilityResult,
		metadata: {
			showNav: false,
			layout: "step",
		},
	},
	{
		path: AppRoutes.Auth,
		component: AuthView,
		metadata: {
			showNav: false,
			layout: "step",
		},
	},
	{
		path: AppRoutes.Dashboard,
		component: DashboardView,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ApplicationOverview,
		component: ApplicationOverview,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.TutorialViewer,
		component: TutorialViewer,
		metadata: {
			showNav: false,
			layout: "step",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.Profile,
		component: ProfileHub,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ProfilePersonalDataEdit,
		component: PersonalDataEdit,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	// TODO: Decide if we need manual edit in user profile or if dashboard questions are enough:
	// {
	// 	path: AppRoutes.ProfileHouseholdEdit,
	// 	component: HouseholdEdit,
	// 	metadata: {
	// 		showNav: true,
	// 		layout: "dashboard",
	// 		requiresAuth: true,
	// 	},
	// },
	// {
	// 	path: AppRoutes.ProfileHousingEdit,
	// 	component: HousingEdit,
	// 	metadata: {
	// 		showNav: true,
	// 		layout: "dashboard",
	// 		requiresAuth: true,
	// 	},
	// },
	{
		path: AppRoutes.ApplicationHouseholdIntro,
		component: ApplicationHouseholdIntro,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ApplicationHouseholdQuestions,
		component: ApplicationHouseholdQuestions,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ApplicationHousingIntro,
		component: ApplicationHousingIntro,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ApplicationHousingQuestions,
		component: ApplicationHousingQuestions,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ApplicationAboutMeIntro,
		component: ApplicationAboutMeIntro,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ApplicationAboutMeQuestions,
		component: ApplicationAboutMeQuestions,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ApplicationIncomeAssetsIntro,
		component: ApplicationIncomeAssetsIntro,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ApplicationIncomeAssetsQuestions,
		component: ApplicationIncomeAssetsQuestions,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ApplicationHealthIntro,
		component: ApplicationHealthIntro,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ApplicationHealthQuestions,
		component: ApplicationHealthQuestions,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ApplicationUploadOptions,
		component: ApplicationUploadOptions,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},

	{
		path: AppRoutes.ProfilePersonalDataUpload,
		component: DocumentDropzone,
		metadata: {
			showNav: false,
			layout: "step",
			requiresAuth: true,
		},
	},

	{
		path: AppRoutes.ProfileSettings,
		component: SettingsView,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ProfileDocuments,
		component: DocumentsOverview,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ProfileDocumentsCategory,
		component: CategoryDocumentsView,
		metadata: {
			showNav: true,
			layout: "dashboard",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ProfileDocumentReview,
		component: DocumentReviewView,
		metadata: {
			showNav: false,
			layout: "step",
			requiresAuth: true,
		},
	},
	{
		path: AppRoutes.ProfileDocumentSuccess,
		component: DocumentReviewSuccessView,
		metadata: {
			showNav: false,
			layout: "step",
			requiresAuth: true,
		},
	},
];

/**
 * Utility to find metadata for the current path using robust React Router matching
 */
export const getRouteMetadata = (pathname: string) => {
	for (const route of routeConfig) {
		const match = matchPath({ path: route.path, end: true }, pathname);
		if (match) {
			return route.metadata;
		}
	}
	return undefined;
};
