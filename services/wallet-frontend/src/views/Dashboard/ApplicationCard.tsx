import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import { MAX_MILESTONE_LEVEL } from "../../store/useProfileStore";
import { useProfile } from "../../hooks/useProfile";
import { useGeneratedPdfModal } from "../../hooks/useGeneratedPdfModal";
import { CompletenessIndicator } from "../../components/Application/CompletenessIndicator";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import fillingFormIllustration from "../../assets/illustrations/filling-form.svg";

interface ApplicationCardProps {
	status: "not_started" | "in_progress" | "completed";
	level?: number;
	formType: string;
}

export const ApplicationCard: React.FC<ApplicationCardProps> = ({
	status,
	level,
	formType,
}) => {
	const { t } = useTranslation("dashboard");
	const navigate = useNavigate();
	const { handleGenerate, isGenerating, error, modal } =
		useGeneratedPdfModal(formType);

	const handleClick = () => {
		navigate(AppRoutes.ApplicationOverview);
	};

	const { milestoneLevel: hookLevel } = useProfile();
	const currentLevel = level !== undefined ? level : hookLevel;

	let descKey = "sections.applications.basic_security.description.in_progress";
	let fallbackDesc =
		"Starte mit Deinem Antrag. Klaro zeigt Dir Schritt-für-Schritt, was wichtig ist.";
	let activeLevel: 0 | 1 | 2 | 3;
	if (status === "not_started") {
		activeLevel = 0;
	} else if (status === "completed") {
		activeLevel = MAX_MILESTONE_LEVEL as 3;
	} else if (currentLevel === 2) {
		activeLevel = 2;
	} else {
		activeLevel = Math.max(0, Math.min(3, Math.floor(currentLevel))) as
			| 0
			| 1
			| 2
			| 3;
	}

	if (status === "not_started") {
		descKey = "sections.applications.basic_security.description.new";
		fallbackDesc =
			"Starte mit Deinem Antrag. Klaro zeigt Dir Schritt-für-Schritt, was wichtig ist.";
	} else if (status === "completed") {
		descKey = "sections.applications.basic_security.description.completed";
		fallbackDesc =
			"Dein Antrag ist fertig – Du kannst das Formular jetzt einreichen!";
	} else if (currentLevel === 2) {
		descKey = "sections.applications.basic_security.description.almost";
		fallbackDesc =
			"Fast fertig! Füge noch die fehlenden Angaben und Dokumente hinzu.";
	}

	return (
		<>
			<div
				onClick={handleClick}
				data-testid="application-card"
				className="bg-white border border-brand-border-subtle rounded-2xl p-6 flex flex-col gap-6 shadow-sm cursor-pointer hover:border-brand-border transition-all"
			>
				<div className="flex flex-col gap-3 min-w-0 flex-1">
					<h2 className="font-semibold text-brand-black text-h2 min-w-0 wrap-break-word pr-2 lg:text-xl/7">
						{t("sections.applications.basic_security.title")}
					</h2>

					<div className="flex flex-row justify-between gap-2 min-w-0 items-start">
						<p className="text-brand-black text-body-lg leading-relaxed mt-1 min-w-0 wrap-break-word">
							{t(descKey, fallbackDesc)}
						</p>

						<img
							src={fillingFormIllustration}
							alt=""
							className="max-w-32 max-h-32 shrink-0 lg:hidden"
							aria-hidden
						/>
					</div>
				</div>

				<CompletenessIndicator level={activeLevel} />

				{error && (
					<p role="alert" className="text-sm text-rose-600 font-medium">
						{error}
					</p>
				)}

				<PrimaryButton
					onClick={(e) => {
						e.stopPropagation();
						void handleGenerate();
					}}
					disabled={isGenerating}
					data-testid="lets-go-button"
				>
					{isGenerating && (
						<Loader2 className="size-5 animate-spin mr-2 shrink-0" />
					)}
					{status === "not_started"
						? t(
								"sections.applications.basic_security.actions.start",
								"Los geht's",
							)
						: t("sections.applications.generate_button", "Antrag generieren")}
				</PrimaryButton>
			</div>

			{/* Rendered outside the clickable card so modal clicks don't bubble to the card's navigation onClick */}
			{modal}
		</>
	);
};
