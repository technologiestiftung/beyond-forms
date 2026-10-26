import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, Upload } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { useIsDesktop } from "../../hooks/useIsDesktop";
import { useOpenDocumentFlow } from "../Profile/documents/useOpenDocumentFlow";
import {
	ApplicationStepLayout,
	PathOption,
	PathOptionGroup,
} from "../../components/Application/ApplicationStepLayout";

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
	const isDesktop = useIsDesktop();
	const openFlow = useOpenDocumentFlow();
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

	const openUpload = (mode: "upload" | "camera") => {
		const path = `${AppRoutes.ProfilePersonalDataUpload}?origin=${origin}&category=${categoryParam}&mode=${mode}`;
		if (isDesktop) {
			openFlow(path);
		} else {
			navigate(path, { state: { returnToPrevious: true } });
		}
	};

	const handleBack = () => {
		const targetRoute = category ? CategoryIntroRoutes[category] : null;
		if (targetRoute) {
			navigate(targetRoute);
		} else {
			navigate(AppRoutes.ApplicationOverview);
		}
	};

	return (
		<ApplicationStepLayout
			title={t("questionnaire.intro.upload_options_title")}
			description={t("questionnaire.intro.upload_options_desc")}
			onBack={handleBack}
			backAriaLabel={t("questionnaire.intro.back_to_intro")}
		>
			<PathOptionGroup>
				<PathOption
					icon={Upload}
					title={t("financial.intro.upload_doc")}
					description={t("financial.intro.upload_desc")}
					onClick={() => openUpload("upload")}
				/>
				<PathOption
					icon={Camera}
					title={t("financial.intro.take_photo")}
					description={t("financial.intro.take_photo_desc")}
					onClick={() => openUpload("camera")}
				/>
			</PathOptionGroup>
		</ApplicationStepLayout>
	);
};

export default ApplicationUploadOptions;
