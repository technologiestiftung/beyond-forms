import React from "react";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "../../../constants/routes";
import { SectionIntroLayout } from "../../../components/Application/SectionIntroLayout";

export const ApplicationHouseholdIntro: React.FC = () => {
	const { t } = useTranslation("application");

	return (
		<SectionIntroLayout
			title={t("questionnaire.sections.household.title")}
			description={t("questionnaire.sections.household.intro_desc")}
			recommendedDocsTitle={t(
				"questionnaire.sections.household.recommended_docs",
			)}
			documents={[t("questionnaire.sections.household.docs_list.declaration")]}
			uploadCategory="household"
			questionsRoute={AppRoutes.ApplicationHouseholdQuestions}
		/>
	);
};

export default ApplicationHouseholdIntro;
