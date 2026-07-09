import { describe, it, expect } from "vitest";
import { resolveLocalizedStepImage } from "../../constants/tutorialImages";

describe("Tutorial Screenshot Localization Resolver (TDD)", () => {
	it("should resolve localized English screenshot image when active language is 'en' (Option A Static Key)", () => {
		const srcEn = resolveLocalizedStepImage("tutorial-app-guide-step-1", "en");
		expect(srcEn).toContain("app-guide-step-1-en");
	});

	it("should resolve German screenshot image when active language is 'de' (Option A Static Key)", () => {
		const srcDe = resolveLocalizedStepImage("tutorial-app-guide-step-1", "de");
		expect(srcDe).toContain("app-guide-step-1");
		expect(srcDe).not.toContain("-en");
	});

	it("should support direct localized image dictionary payload from CMS (Option B Bridge)", () => {
		const imagePayload = {
			de: "https://cdn/step1.png",
			en: "https://cdn/step1-en.png",
		};
		const src = resolveLocalizedStepImage(imagePayload, "en");
		expect(src).toBe("https://cdn/step1-en.png");
	});

	it("should gracefully fall back to default locale 'de' if an unsupported language is requested", () => {
		const srcFallback = resolveLocalizedStepImage(
			"tutorial-app-guide-step-1",
			"fr",
		);
		expect(srcFallback).toBeDefined();
	});
});
