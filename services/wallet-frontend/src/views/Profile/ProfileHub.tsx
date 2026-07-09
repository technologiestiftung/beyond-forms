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

export const ProfileHub: React.FC = () => {
	const { t } = useTranslation("profile");
	const navigate = useNavigate();
	const { profileData, documents } = useProfile();
	const personalData: Partial<PersonalData> = profileData?.personalData || {};

	const firstName = personalData.firstName || "User";

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
		<PageContainer topBarProps={{ showLanguageSwitcher: true }}>
			<div className="flex flex-col items-center gap-4 text-center mb-8">
				<div className="w-20 h-20 bg-primary-green-500 border border-primary-green-300 rounded-full flex items-center justify-center shadow-sm text-primary-blue-500">
					<User className="w-10 h-10" />
				</div>
				<h1
					data-testid="profile-name"
					className="text-3xl font-extrabold text-slate-900"
				>
					{t("welcome", {
						name: firstName,
						defaultValue: `Hallo ${firstName}!`,
					})}
				</h1>
			</div>

			<div className="flex flex-col gap-4 w-full max-w-md mx-auto">
				<ProfileSectionCard
					title={t("sections.personal.title", "Persönliche Angaben")}
					description={t(
						"sections.personal.desc",
						"Name, Geburtsdatum und weitere persönliche Angaben",
					)}
					status={getPersonalStatus()}
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
					status="PARTIAL"
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
					status="COMPLETE"
					icon={<Settings className="size-6" />}
					onClick={() => navigate(AppRoutes.ProfileSettings)}
					data-testid="section-settings"
				/>
			</div>
		</PageContainer>
	);
};
