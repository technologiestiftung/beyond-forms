import React from "react";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "../../../constants/routes";
import { SectionIntroLayout } from "../../../components/Application/SectionIntroLayout";

export const ApplicationHousingIntro: React.FC = () => {
	const { t } = useTranslation("application");

	return (
		<SectionIntroLayout
			title={t("questionnaire.sections.housing.title", "Dein Wohnen")}
			description={t(
				"questionnaire.sections.housing.intro_desc",
				"Lade Dokumente hoch.\nDer Assistent übernimmt viele Angaben automatisch. Du kannst sie später prüfen.",
			)}
			recommendedDocsTitle={t(
				"questionnaire.sections.housing.recommended_docs",
				"Empfohlene Dokumente",
			)}
			documents={[
				t(
					"questionnaire.sections.housing.docs_list.rental_contract",
					"Mietvertrag / Untermietvertrag",
				),
				t(
					"questionnaire.sections.housing.docs_list.heating_proof",
					"Heizkostennachweis / Gasrechnung",
				),
				t(
					"questionnaire.sections.housing.docs_list.utility_statement",
					"Nebenkostenabrechnung",
				),
			]}
			uploadCategory="housing"
			questionsRoute={AppRoutes.ApplicationHousingQuestions}
		/>
	);
};
