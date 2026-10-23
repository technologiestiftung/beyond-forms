import React from "react";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "../../../constants/routes";
import { SectionIntroLayout } from "../../../components/Application/SectionIntroLayout";

export const ApplicationHealthIntro: React.FC = () => {
	const { t } = useTranslation("application");

	return (
		<SectionIntroLayout
			title={t("health.intro.title", "Gesundheit und Pflege")}
			description={t(
				"health.intro.desc",
				"Lade Nachweise hoch, um Unterstützung bei Pflege oder Mehrbedarf bei Behinderung zu erhalten. Der Assistent übernimmt viele Angaben automatisch.",
			)}
			recommendedDocsTitle={t(
				"health.intro.recommended_docs",
				"Empfohlene Dokumente",
			)}
			documents={[
				t("health.intro.doc_list.care_pills", "Pflegegradbescheid"),
				t("health.intro.doc_list.disability_card", "Schwerbehindertenausweis"),
				t(
					"health.intro.doc_list.nursing_home_contract",
					"Heimvertrag oder Heimkostenaufstellung",
				),
				t(
					"health.intro.doc_list.care_service_invoice",
					"Rechnungen des Pflegedienstes",
				),
			]}
			uploadCategory="health"
			questionsRoute={AppRoutes.ApplicationHealthQuestions}
		/>
	);
};
