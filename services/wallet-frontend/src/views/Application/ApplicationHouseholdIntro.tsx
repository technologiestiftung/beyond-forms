import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Upload } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { PageContainer } from "../../components/Layout/PageContainer";

export const ApplicationHouseholdIntro: React.FC = () => {
	const { t } = useTranslation("application");
	const navigate = useNavigate();

	return (
		<PageContainer>
			<div className="flex flex-col gap-6 w-full min-w-0 max-w-md mx-auto text-left pt-4">
				{/* Circular back button */}
				<div>
					<button
						type="button"
						onClick={() => navigate(AppRoutes.ApplicationOverview)}
						className="size-10 bg-primary-green-500 hover:bg-primary-green-800 text-brand-black rounded-full flex items-center justify-center shrink-0 transition-colors focus-visible:ring-2 focus-visible:ring-primary-blue-500 focus-visible:ring-offset-2 focus:outline-none"
						aria-label={t(
							"questionnaire.intro.back_to_overview",
							"Zurück zur Übersicht",
						)}
					>
						<ArrowLeft className="size-5 stroke-[2.5]" aria-hidden="true" />
					</button>
				</div>

				{/* Header */}
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
						{t(
							"questionnaire.sections.household.title",
							"Familie und Haushalt",
						)}
					</h1>
					<p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
						{t(
							"questionnaire.sections.household.intro_desc",
							"Lade Nachweise hoch, um Angaben zu Deiner Familie und Deinem Haushalt zu machen. Der Assistent übernimmt viele Angaben automatisch.",
						)}
					</p>
				</div>

				{/* Plain list for Recommended Documents */}
				<div className="flex flex-col gap-2">
					<h3 className="font-extrabold text-slate-900 text-sm tracking-wide">
						{t(
							"questionnaire.sections.household.recommended_docs",
							"Empfohlene Dokumente",
						)}
					</h3>
					<ul className="list-disc pl-5 flex flex-col gap-2 text-sm font-medium text-slate-800">
						<li>
							{t(
								"questionnaire.sections.household.docs_list.declaration",
								"Haushaltsangehörige / Bedarfsgemeinschaftserklärung",
							)}
						</li>
					</ul>
				</div>

				{/* Buttons Card Container */}
				<div className="bg-primary-blue-20/30 border border-primary-blue-50/40 rounded-3xl p-4 flex flex-col gap-3">
					<button
						type="button"
						onClick={() =>
							navigate(
								`${AppRoutes.ApplicationUploadOptions}?category=household&origin=wizard`,
							)
						}
						className="flex items-center gap-4 p-4 bg-white border border-slate-100 hover:border-slate-200 focus-visible:ring-2 focus-visible:ring-primary-blue-500 focus-visible:ring-offset-2 focus:outline-none rounded-2xl w-full text-left transition-all shadow-sm group"
					>
						<div className="size-12 bg-primary-green-200 group-hover:bg-primary-green-300 rounded-xl flex items-center justify-center text-brand-black shrink-0 transition-colors">
							<Upload className="size-6 text-brand-black" aria-hidden="true" />
						</div>
						<div className="flex flex-col">
							<span className="font-extrabold text-slate-900 text-sm">
								{t(
									"questionnaire.intro.path_upload_title",
									"Dokumente hochladen",
								)}
							</span>
							<span className="text-xs text-slate-500 mt-0.5">
								{t(
									"questionnaire.intro.path_upload_desc",
									"Lade Nachweise hoch, um Angaben automatisch auszufüllen.",
								)}
							</span>
						</div>
					</button>

					<button
						type="button"
						onClick={() => navigate(AppRoutes.ApplicationHouseholdQuestions)}
						className="flex items-center gap-4 p-4 bg-white border border-slate-100 hover:border-slate-200 focus-visible:ring-2 focus-visible:ring-primary-blue-500 focus-visible:ring-offset-2 focus:outline-none rounded-2xl w-full text-left transition-all shadow-sm group"
					>
						<div className="size-12 bg-primary-green-200 group-hover:bg-primary-green-300 rounded-xl flex items-center justify-center text-brand-black shrink-0 transition-colors">
							<FileText
								className="size-6 text-brand-black"
								aria-hidden="true"
							/>
						</div>
						<div className="flex flex-col">
							<span className="font-extrabold text-slate-900 text-sm">
								{t(
									"questionnaire.intro.path_manual_title",
									"Angaben manuell ausfüllen",
								)}
							</span>
							<span className="text-xs text-slate-500 mt-0.5">
								{t(
									"questionnaire.intro.path_manual_desc",
									"Trage Deine Daten Schritt für Schritt selbst ein.",
								)}
							</span>
						</div>
					</button>
				</div>
			</div>
		</PageContainer>
	);
};

export default ApplicationHouseholdIntro;
