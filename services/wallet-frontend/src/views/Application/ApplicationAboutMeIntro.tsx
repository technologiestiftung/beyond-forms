import React from "react";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "../../constants/routes";
import { SectionIntroLayout } from "../../components/Application/SectionIntroLayout";

export const ApplicationAboutMeIntro: React.FC = () => {
	const { t } = useTranslation("application");

	return (
		<SectionIntroLayout
			title={t("questionnaire.sections.about_me.title", "Über Dich")}
			description={t(
				"questionnaire.sections.about_me.intro_desc",
				"Lade Dokumente hoch.\nDer Assistent übernimmt viele Angaben automatisch. Du kannst sie später prüfen.",
			)}
			recommendedDocsTitle={t(
				"questionnaire.sections.about_me.recommended_docs",
				"Empfohlene Dokumente",
			)}
			documents={[
				t(
					"questionnaire.sections.about_me.docs_list.id_card",
					"Personalausweis",
				),
				t("questionnaire.sections.about_me.docs_list.passport", "Reisepass"),
				t(
					"questionnaire.sections.about_me.docs_list.residence_permit",
					"Aufenthaltstitel",
				),
				t(
					"questionnaire.sections.about_me.docs_list.tolerated_stay",
					"Aufenthaltsgestattung/Duldung",
				),
			]}
			uploadCategory="about_me"
			questionsRoute={AppRoutes.ApplicationAboutMeQuestions}
		/>
	);
};
