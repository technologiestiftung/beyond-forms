/**
 * Slugs for tutorials used in onboarding / welcome checklist.
 * Must stay in sync with `cms_tutorials.slug` (seed data and CMS).
 */
export const ONBOARDING_TUTORIAL_SLUGS = {
	basicIncome: "was-ist-grundsicherung",
	appGuide: "wie-funktioniert-die-applikation",
} as const;

export type OnboardingTutorialSlug =
	(typeof ONBOARDING_TUTORIAL_SLUGS)[keyof typeof ONBOARDING_TUTORIAL_SLUGS];
