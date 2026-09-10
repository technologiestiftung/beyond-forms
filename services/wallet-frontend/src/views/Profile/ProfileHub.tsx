import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { User, FileText, Settings } from "lucide-react";
import { ProfileSectionCard } from "../../components/Profile/ProfileSectionCard";
import type { SectionStatus } from "../../components/Profile/ProfileSectionCard";
import { AppRoutes } from "../../constants/routes";
import { useProfile } from "../../hooks/useProfile";
import { PageContainer } from "../../components/Layout/PageContainer";
import type { PersonalData } from "../../schemas/profile.schema";
import {
	getActiveDocumentSlots,
	doesDocumentMatchSlot,
} from "../../utils/profile";
import { GreetingHeader } from "../../components/Layout/GreetingHeader";

const STATUS_LABEL: Record<SectionStatus, [string, string]> = {
	COMPLETE: ["status.complete", "Vollständig"],
	PARTIAL: ["status.partial", "Teilweise vollständig"],
	MISSING: ["status.missing", "Fehlt noch"],
	PROCESSING: ["status.processing", "Wird geprüft"],
};

export const ProfileHub: React.FC = () => {
	const { t } = useTranslation("profile");
	const navigate = useNavigate();
	const { profileData, documents } = useProfile();
	const personalData: Partial<PersonalData> = profileData?.personalData || {};

	const firstName = personalData.firstName || "User";
	const openLabel = t("common.open", "Öffnen");

	const getDocumentsStatus = (): SectionStatus => {
		if (documents.some((doc) => doc.status === "PROCESSING")) {
			return "PROCESSING";
		}

		const slots = getActiveDocumentSlots(profileData ?? {});
		const covered = slots.filter((slot) =>
			documents.some((doc) => doesDocumentMatchSlot(doc, slot)),
		).length;

		if (covered === 0) {
			return "MISSING";
		}
		return covered === slots.length ? "COMPLETE" : "PARTIAL";
	};

	const getPersonalStatus = (): SectionStatus => {
		const isProcessing = documents.some(
			(doc) => doc.type === "id_card" && doc.status === "PROCESSING",
		);
		if (isProcessing) {
			return "PROCESSING";
		}
		if (!personalData.firstName) {
			return "MISSING";
		}
		if (Object.values(personalData).some((v) => !v)) {
			return "PARTIAL";
		}
		return "COMPLETE";
	};

	return (
		<PageContainer
			topBarProps={{
				showLanguageSwitcher: true,
				className: "lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pt-4",
			}}
			contentClassName="lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pb-16"
		>
			<div className="mb-8 w-full lg:mb-8">
				<GreetingHeader
					headingTestId="profile-name"
					title={t("welcome", {
						name: firstName,
						defaultValue: `Hallo ${firstName}!`,
					})}
					subtitle={t(
						"subtitle",
						"Hier verwaltest Du Deine Angaben, Dokumente und Einstellungen. Klaro übernimmt sie für alle Anträge.",
					)}
				/>
			</div>

			<div className="flex flex-col gap-4 w-full max-w-md mx-auto lg:max-w-none lg:mx-0 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(288px,1fr))] lg:gap-5 lg:items-stretch">
				<ProfileSectionCard
					title={t("sections.personal.title", "Persönliche Angaben")}
					description={t(
						"sections.personal.desc",
						"Name, Geburtsdatum und weitere persönliche Angaben",
					)}
					status={getPersonalStatus()}
					statusLabel={t(...STATUS_LABEL[getPersonalStatus()])}
					actionLabel={openLabel}
					icon={<User className="size-6" />}
					onClick={() => navigate(AppRoutes.ProfilePersonalDataEdit)}
					data-testid="section-personal"
				/>
				<ProfileSectionCard
					title={t("sections.documents.title", "Meine Dokumente")}
					description={t(
						"sections.documents.desc",
						"Dokumente für Anträge und andere Services",
					)}
					status={getDocumentsStatus()}
					statusLabel={t(...STATUS_LABEL[getDocumentsStatus()])}
					actionLabel={openLabel}
					icon={<FileText className="size-6" />}
					onClick={() => navigate(AppRoutes.ProfileDocuments)}
					data-testid="section-documents"
				/>

				<ProfileSectionCard
					title={t("sections.settings.title", "Einstellungen")}
					description={t(
						"sections.settings.desc",
						"Sprache, Benachrichtigungen und Wallet",
					)}
					actionLabel={openLabel}
					icon={<Settings className="size-6" />}
					onClick={() => navigate(AppRoutes.ProfileSettings)}
					data-testid="section-settings"
				/>
			</div>
		</PageContainer>
	);
};
