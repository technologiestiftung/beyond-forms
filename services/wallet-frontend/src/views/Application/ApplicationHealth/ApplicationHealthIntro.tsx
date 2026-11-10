import React from "react";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "../../../constants/routes";
import { SectionIntroLayout } from "../../../components/Application/SectionIntroLayout";

export const ApplicationHealthIntro: React.FC = () => {
	const { t } = useTranslation("application");

	return (
		<SectionIntroLayout
			title={t("health.intro.title")}
			description={t("health.intro.desc")}
			recommendedDocsTitle={t("health.intro.recommended_docs")}
			documents={[
				t("health.intro.doc_list.care_pills"),
				t("health.intro.doc_list.disability_card"),
				t("health.intro.doc_list.nursing_home_contract"),
				t("health.intro.doc_list.care_service_invoice"),
			]}
			uploadCategory="health"
			questionsRoute={AppRoutes.ApplicationHealthQuestions}
		/>
	);
};
