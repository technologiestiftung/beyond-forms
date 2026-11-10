import React from "react";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "../../../constants/routes";
import { SectionIntroLayout } from "../../../components/Application/SectionIntroLayout";

export const ApplicationAboutMeIntro: React.FC = () => {
	const { t } = useTranslation("application");

	return (
		<SectionIntroLayout
			title={t("questionnaire.sections.about_me.title")}
			description={t("questionnaire.sections.about_me.intro_desc")}
			recommendedDocsTitle={t(
				"questionnaire.sections.about_me.recommended_docs",
			)}
			documents={[
				t("questionnaire.sections.about_me.docs_list.id_card"),
				t("questionnaire.sections.about_me.docs_list.passport"),
				t("questionnaire.sections.about_me.docs_list.residence_permit"),
				t("questionnaire.sections.about_me.docs_list.tolerated_stay"),
			]}
			uploadCategory="about_me"
			questionsRoute={AppRoutes.ApplicationAboutMeQuestions}
		/>
	);
};
