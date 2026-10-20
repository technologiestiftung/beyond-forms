import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FileText, Upload } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import {
	ApplicationStepLayout,
	PathOption,
	PathOptionGroup,
} from "./ApplicationStepLayout";

interface SectionIntroLayoutProps {
	title: string;
	description: string;
	recommendedDocsTitle: string;
	documents: string[];
	uploadCategory: string;
	questionsRoute: string;
}

export const SectionIntroLayout: React.FC<SectionIntroLayoutProps> = ({
	title,
	description,
	recommendedDocsTitle,
	documents,
	uploadCategory,
	questionsRoute,
}) => {
	const { t } = useTranslation("application");
	const navigate = useNavigate();

	return (
		<ApplicationStepLayout
			title={title}
			description={description}
			onBack={() => navigate(AppRoutes.ApplicationOverview)}
			backAriaLabel={t(
				"questionnaire.intro.back_to_overview",
				"Zurück zur Übersicht",
			)}
		>
			<div className="flex flex-col gap-2 lg:gap-3">
				<h2 className="font-extrabold text-slate-900 text-sm tracking-wide lg:text-base">
					{recommendedDocsTitle}
				</h2>
				<ul className="list-disc pl-5 flex flex-col gap-2 text-sm font-medium text-slate-800 lg:text-body-lg lg:font-normal">
					{documents.map((label, index) => (
						<li key={index}>{label}</li>
					))}
				</ul>
			</div>

			<PathOptionGroup>
				<PathOption
					icon={Upload}
					title={t(
						"questionnaire.intro.path_upload_title",
						"Dokumente hochladen",
					)}
					description={t(
						"questionnaire.intro.path_upload_desc",
						"Lade Nachweise hoch, um Angaben automatisch auszufüllen.",
					)}
					onClick={() =>
						navigate(
							`${AppRoutes.ApplicationUploadOptions}?category=${uploadCategory}&origin=wizard`,
						)
					}
				/>
				<PathOption
					icon={FileText}
					title={t(
						"questionnaire.intro.path_manual_title",
						"Angaben manuell ausfüllen",
					)}
					description={t(
						"questionnaire.intro.path_manual_desc",
						"Trage Deine Daten Schritt für Schritt selbst ein.",
					)}
					onClick={() => navigate(questionsRoute)}
				/>
			</PathOptionGroup>
		</ApplicationStepLayout>
	);
};
