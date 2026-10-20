import React from "react";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "../../constants/routes";
import { SectionIntroLayout } from "../../components/Application/SectionIntroLayout";

export const ApplicationHouseholdIntro: React.FC = () => {
	const { t } = useTranslation("application");

	return (
		<SectionIntroLayout
			title={t(
				"questionnaire.sections.household.title",
				"Familie und Haushalt",
			)}
			description={t(
				"questionnaire.sections.household.intro_desc",
				"Lade Nachweise hoch, um Angaben zu Deiner Familie und Deinem Haushalt zu machen. Der Assistent übernimmt viele Angaben automatisch.",
			)}
			recommendedDocsTitle={t(
				"questionnaire.sections.household.recommended_docs",
				"Empfohlene Dokumente",
			)}
			documents={[
				t(
					"questionnaire.sections.household.docs_list.declaration",
					"Haushaltsangehörige / Bedarfsgemeinschaftserklärung",
				),
			]}
			uploadCategory="household"
			questionsRoute={AppRoutes.ApplicationHouseholdQuestions}
		/>
	);
};

export default ApplicationHouseholdIntro;
