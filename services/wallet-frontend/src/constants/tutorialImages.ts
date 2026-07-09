import appGuideStep1De from "../assets/tutorial-images/app-guide-step-1.png";
import appGuideStep1En from "../assets/tutorial-images/app-guide-step-1-en.png";
import appGuideStep2De from "../assets/tutorial-images/app-guide-step-2.png";
import appGuideStep2En from "../assets/tutorial-images/app-guide-step-2-en.png";
import appGuideStep3De from "../assets/tutorial-images/app-guide-step-3.png";
import appGuideStep3En from "../assets/tutorial-images/app-guide-step-3-en.png";
import appGuideStep4De from "../assets/tutorial-images/app-guide-step-4.png";
import appGuideStep4En from "../assets/tutorial-images/app-guide-step-4-en.png";
import { DEFAULT_LOCALE } from "./locale";

export type LocalizedImageMap = Record<string, string>;

export const TUTORIAL_STEP_IMAGES: Record<string, LocalizedImageMap> = {
	"tutorial-app-guide-step-1": {
		de: appGuideStep1De,
		en: appGuideStep1En,
	},
	"tutorial-app-guide-step-2": {
		de: appGuideStep2De,
		en: appGuideStep2En,
	},
	"tutorial-app-guide-step-3": {
		de: appGuideStep3De,
		en: appGuideStep3En,
	},
	"tutorial-app-guide-step-4": {
		de: appGuideStep4De,
		en: appGuideStep4En,
	},
};

export function resolveLocalizedStepImage(
	imageProp: string | Record<string, unknown> | undefined | null,
	lang: string,
): string | undefined {
	if (!imageProp) {
		return undefined;
	}

	// 1. Direct Localized Object Payload (Option B - CMS Bridge)
	if (typeof imageProp === "object" && !Array.isArray(imageProp)) {
		// Safely check for standard nested media URL fields
		if ("url" in imageProp && typeof imageProp.url === "string") {
			return imageProp.url;
		}

		// Filter out non-string metadata values to prevent rendering crashes
		const stringValues = Object.entries(imageProp)
			.filter(([_, v]) => typeof v === "string")
			.reduce(
				(acc, [k, v]) => ({ ...acc, [k]: v as string }),
				{} as LocalizedImageMap,
			);

		return (
			stringValues[lang] ||
			stringValues[DEFAULT_LOCALE] ||
			stringValues["en"] ||
			Object.values(stringValues)[0]
		);
	}

	// 2. String Reference Lookup (Option A - Static Asset Key)
	if (typeof imageProp === "string") {
		if (imageProp.startsWith("http") || imageProp.startsWith("/")) {
			return imageProp;
		}

		const candidate = TUTORIAL_STEP_IMAGES[imageProp];
		if (!candidate) {
			return undefined;
		}

		// Standard fallback sequence: Target Language -> Default (de) -> English -> First available
		return (
			candidate[lang] ||
			candidate[DEFAULT_LOCALE] ||
			candidate["en"] ||
			Object.values(candidate)[0]
		);
	}

	return undefined;
}
