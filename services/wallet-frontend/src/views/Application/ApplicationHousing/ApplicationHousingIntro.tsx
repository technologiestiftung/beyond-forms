import React from "react";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "../../../constants/routes";
import { SectionIntroLayout } from "../../../components/Application/SectionIntroLayout";

export const ApplicationHousingIntro: React.FC = () => {
	const { t } = useTranslation("application");

	return (
		<SectionIntroLayout
			title={t("questionnaire.sections.housing.title")}
			description={t("questionnaire.sections.housing.intro_desc")}
			recommendedDocsTitle={t(
				"questionnaire.sections.housing.recommended_docs",
			)}
			documents={[
				t("questionnaire.sections.housing.docs_list.rental_contract"),
				t("questionnaire.sections.housing.docs_list.heating_proof"),
				t("questionnaire.sections.housing.docs_list.utility_statement"),
			]}
			uploadCategory="housing"
			questionsRoute={AppRoutes.ApplicationHousingQuestions}
		/>
	);
};
