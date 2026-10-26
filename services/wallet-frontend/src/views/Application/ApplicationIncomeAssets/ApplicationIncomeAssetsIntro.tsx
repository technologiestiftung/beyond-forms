import React from "react";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "../../../constants/routes";
import { SectionIntroLayout } from "../../../components/Application/SectionIntroLayout";

export const ApplicationIncomeAssetsIntro: React.FC = () => {
	const { t } = useTranslation("application");

	return (
		<SectionIntroLayout
			title={t("questionnaire.sections.income_assets.title")}
			description={t("financial.intro.intro_desc")}
			recommendedDocsTitle={t("financial.intro.recommended_docs")}
			documents={[
				t("financial.intro.doc_list.statements"),
				t("financial.intro.doc_list.pension"),
				t("financial.intro.doc_list.other_income"),
			]}
			uploadCategory="income_assets"
			questionsRoute={AppRoutes.ApplicationIncomeAssetsQuestions}
		/>
	);
};
