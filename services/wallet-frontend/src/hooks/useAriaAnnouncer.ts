import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../i18n/i18nKeys";

export const useAriaAnnouncer = () => {
	const location = useLocation();
	const { t } = useTranslation();

	const getAnnouncement = () => {
		const path = location.pathname;
		if (path === "/") {
			return t(i18nKeys.aria.welcome);
		}
		if (path.startsWith("/eligibility-check")) {
			return t(i18nKeys.aria.questionnaire);
		}
		return "";
	};

	return { announcement: getAnnouncement() };
};
