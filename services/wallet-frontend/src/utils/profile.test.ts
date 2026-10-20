import { describe, it, expect } from "vitest";
import { getTargetExitRoute } from "./profile";
import { AppRoutes } from "../constants/routes";

describe("getTargetExitRoute", () => {
	it.each([
		[
			"about_me",
			AppRoutes.ApplicationAboutMeIntro,
			AppRoutes.ApplicationAboutMeQuestions,
		],
		[
			"housing",
			AppRoutes.ApplicationHousingIntro,
			AppRoutes.ApplicationHousingQuestions,
		],
		[
			"income_assets",
			AppRoutes.ApplicationIncomeAssetsIntro,
			AppRoutes.ApplicationIncomeAssetsQuestions,
		],
		[
			"health",
			AppRoutes.ApplicationHealthIntro,
			AppRoutes.ApplicationHealthQuestions,
		],
		[
			"household",
			AppRoutes.ApplicationHouseholdIntro,
			AppRoutes.ApplicationHouseholdQuestions,
		],
	])("routes the %s wizard section", (category, intro, questions) => {
		expect(getTargetExitRoute("wizard", category, "back")).toBe(
			`${AppRoutes.ApplicationUploadOptions}?category=${category}&origin=wizard`,
		);
		expect(getTargetExitRoute("wizard", category, "upload")).toBe(intro);
		expect(getTargetExitRoute("wizard", category, "review_success")).toBe(
			questions,
		);
	});

	it("falls back to the overview for an unknown wizard section", () => {
		expect(getTargetExitRoute("wizard", "unknown", "back")).toBe(
			AppRoutes.ApplicationOverview,
		);
		expect(getTargetExitRoute("wizard", null, "upload")).toBe(
			AppRoutes.ApplicationOverview,
		);
	});

	it("returns to the profile documents outside the wizard", () => {
		expect(getTargetExitRoute("hub", "identity", "back")).toBe(
			"/profile/documents/category/identity",
		);
		expect(getTargetExitRoute("hub", null, "upload")).toBe(
			AppRoutes.ProfileDocuments,
		);
	});
});
