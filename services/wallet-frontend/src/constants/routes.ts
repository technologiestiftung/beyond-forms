/**
 * AppRoutes defines all available paths in the application.
 * Centralizing these prevents "string rot" and makes it easy to refactor URL structures.
 */
export const AppRoutes = {
	Home: "/",
	EligibilityCheck: "/eligibility-check/:questionId",
	EligibilityResult: "/eligibility-check/result",

	Auth: "/auth",
	Dashboard: "/dashboard",
	ApplicationOverview: "/dashboard/application/overview",
	TutorialViewer: "/tutorial/:slug",
	Profile: "/profile",
	ProfilePersonalDataEdit: "/profile/personal/edit",
	// TODO: Decide if we need manual edit in user profile or if dashboard questions are enough:
	// ProfileHouseholdEdit: "/profile/household/edit",
	// ProfileHousingEdit: "/profile/housing/edit",
	ApplicationAboutMeIntro: "/dashboard/application/about-me",
	ApplicationAboutMeQuestions: "/dashboard/application/about-me/questions",
	ApplicationHouseholdIntro: "/dashboard/application/household",
	ApplicationHouseholdQuestions: "/dashboard/application/household/questions",
	ApplicationHousingIntro: "/dashboard/application/housing",
	ApplicationHousingQuestions: "/dashboard/application/housing/questions",
	ApplicationIncomeAssetsIntro: "/dashboard/application/income-assets",
	ApplicationIncomeAssetsQuestions:
		"/dashboard/application/income-assets/questions",
	ApplicationHealthIntro: "/dashboard/application/health",
	ApplicationHealthQuestions: "/dashboard/application/health/questions",
	ApplicationUploadOptions: "/dashboard/application/upload-options",

	ProfilePersonalDataUpload: "/profile/personal/upload",
	ProfileSettings: "/profile/settings",
	ProfileDocuments: "/profile/documents",
	ProfileDocumentReview: "/profile/documents/:documentId/review",
	ProfileDocumentSuccess: "/profile/documents/:documentId/success",
	ProfileDocumentsCategory: "/profile/documents/category/:categoryId",
} as const;

export type AppRoutesType = (typeof AppRoutes)[keyof typeof AppRoutes];

/**
 * URL Parameters used across the application.
 */
export const URL_PARAMS = {
	ORIGIN: "origin",
	ORIGIN_ELIGIBILITY: "eligibility",
} as const;

/**
 * Utility to generate dynamic routes
 */
export const getEligibilityRoute = (questionId: string) =>
	AppRoutes.EligibilityCheck.replace(":questionId", questionId);
