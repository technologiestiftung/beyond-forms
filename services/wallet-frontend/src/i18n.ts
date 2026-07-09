import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enEligibility from "./locales/en/eligibility.json";
import deEligibility from "./locales/de/eligibility.json";
import enAuth from "./locales/en/auth.json";
import deAuth from "./locales/de/auth.json";
import enProfile from "./locales/en/profile.json";
import deProfile from "./locales/de/profile.json";
import enDashboard from "./locales/en/dashboard.json";
import deDashboard from "./locales/de/dashboard.json";
import enCommon from "./locales/en/common.json";
import deCommon from "./locales/de/common.json";
import enChat from "./locales/en/chat.json";
import deChat from "./locales/de/chat.json";
import enApplication from "./locales/en/application.json";
import deApplication from "./locales/de/application.json";
import { DEFAULT_LOCALE } from "./constants/locale";

const getInitialLanguage = () => {
	try {
		const stored = localStorage.getItem("beyond-forms-preferences");
		if (stored) {
			const parsed = JSON.parse(stored);
			return parsed.state?.language || DEFAULT_LOCALE;
		}
	} catch (_e) {
		// Standard catch logic for potential localStorage access issues
	}
	return DEFAULT_LOCALE;
};

i18n.use(initReactI18next).init({
	ns: [
		"translation",
		"auth",
		"profile",
		"dashboard",
		"common",
		"chat",
		"application",
	],
	defaultNS: "translation",
	resources: {
		en: {
			translation: enEligibility,
			auth: enAuth,
			profile: enProfile,
			dashboard: enDashboard,
			common: enCommon,
			chat: enChat,
			application: enApplication,
		},
		de: {
			translation: deEligibility,
			auth: deAuth,
			profile: deProfile,
			dashboard: deDashboard,
			common: deCommon,
			chat: deChat,
			application: deApplication,
		},
	},
	lng: getInitialLanguage(),
	fallbackLng: DEFAULT_LOCALE,
	interpolation: {
		escapeValue: false,
	},
});

export default i18n;
