import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Camera, Upload } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { PageContainer } from "../../components/Layout/PageContainer";

type WizardCategory =
	"about_me" | "housing" | "income_assets" | "health" | "household";

const CategoryIntroRoutes: Record<WizardCategory, string> = {
	about_me: AppRoutes.ApplicationAboutMeIntro,
	housing: AppRoutes.ApplicationHousingIntro,
	income_assets: AppRoutes.ApplicationIncomeAssetsIntro,
	health: AppRoutes.ApplicationHealthIntro,
	household: AppRoutes.ApplicationHouseholdIntro,
};

export const ApplicationUploadOptions: React.FC = () => {
	const { t } = useTranslation("application");
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const categoryParam = searchParams.get("category") || "";
	const category = [
		"about_me",
		"housing",
		"income_assets",
		"health",
		"household",
	].includes(categoryParam)
		? (categoryParam as WizardCategory)
		: null;

	const origin = searchParams.get("origin") || "wizard";

	const handleBack = () => {
		const targetRoute = category ? CategoryIntroRoutes[category] : null;
		if (targetRoute) {
			navigate(targetRoute);
		} else {
			navigate(AppRoutes.ApplicationOverview);
		}
	};

	return (
		<PageContainer>
			<div className="flex flex-col gap-6 w-full min-w-0 max-w-md mx-auto text-left pt-4">
				{/* Circular back button */}
				<div>
					<button
						type="button"
						onClick={handleBack}
						className="size-10 bg-primary-green-500 hover:bg-primary-green-800 text-brand-black rounded-full flex items-center justify-center shrink-0 transition-colors focus-visible:ring-2 focus-visible:ring-primary-blue-500 focus-visible:ring-offset-2 focus:outline-none"
						aria-label={t(
							"questionnaire.intro.back_to_intro",
							"Zurück zur Einführung",
						)}
					>
						<ArrowLeft className="size-5 stroke-[2.5]" aria-hidden="true" />
					</button>
				</div>

				{/* Header */}
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
						{t(
							"questionnaire.intro.upload_options_title",
							"Wie möchtest Du Dokumente einreichen?",
						)}
					</h1>
					<p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
						{t(
							"questionnaire.intro.upload_options_desc",
							"Wähle eine Option, um Deine Dokumente hochzuladen.",
						)}
					</p>
				</div>

				{/* Option Buttons Container */}
				<div className="bg-primary-blue-20/30 border border-primary-blue-50/40 rounded-3xl p-4 flex flex-col gap-3">
					<button
						type="button"
						onClick={() =>
							navigate(
								`${AppRoutes.ProfilePersonalDataUpload}?origin=${origin}&category=${categoryParam}&mode=upload`,
							)
						}
						className="flex items-center gap-4 p-4 bg-white border border-slate-100 hover:border-slate-200 focus-visible:ring-2 focus-visible:ring-primary-blue-500 focus-visible:ring-offset-2 focus:outline-none rounded-2xl w-full text-left transition-all shadow-sm group"
					>
						<div className="size-12 bg-primary-green-200 group-hover:bg-primary-green-300 rounded-xl flex items-center justify-center text-brand-black shrink-0 transition-colors">
							<Upload className="size-6 text-brand-black" aria-hidden="true" />
						</div>
						<div className="flex flex-col">
							<span className="font-extrabold text-slate-900 text-sm">
								{t("financial.intro.upload_doc", "Dokument hochladen")}
							</span>
							<span className="text-xs text-slate-500 mt-0.5">
								{t("financial.intro.upload_desc", "Wähle ein Dokument aus.")}
							</span>
						</div>
					</button>

					<button
						type="button"
						onClick={() =>
							navigate(
								`${AppRoutes.ProfilePersonalDataUpload}?origin=${origin}&category=${categoryParam}&mode=camera`,
							)
						}
						className="flex items-center gap-4 p-4 bg-white border border-slate-100 hover:border-slate-200 focus-visible:ring-2 focus-visible:ring-primary-blue-500 focus-visible:ring-offset-2 focus:outline-none rounded-2xl w-full text-left transition-all shadow-sm group"
					>
						<div className="size-12 bg-primary-green-200 group-hover:bg-primary-green-300 rounded-xl flex items-center justify-center text-brand-black shrink-0 transition-colors">
							<Camera className="size-6 text-brand-black" aria-hidden="true" />
						</div>
						<div className="flex flex-col">
							<span className="font-extrabold text-slate-900 text-sm">
								{t("financial.intro.take_photo", "Mit Kamera aufnehmen")}
							</span>
							<span className="text-xs text-slate-500 mt-0.5">
								{t(
									"financial.intro.take_photo_desc",
									"Nimm ein Foto deines Dokuments auf.",
								)}
							</span>
						</div>
					</button>
				</div>
			</div>
		</PageContainer>
	);
};

export default ApplicationUploadOptions;
