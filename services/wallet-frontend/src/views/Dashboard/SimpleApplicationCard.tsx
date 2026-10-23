import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { useGeneratedPdfModal } from "../../hooks/useGeneratedPdfModal";
import { useFormCompleteness } from "../../hooks/useFormCompleteness";
import { useKnowledgeCompleteness } from "../../hooks/useKnowledgeCompleteness";
import { CompletenessIndicator } from "../../components/Application/CompletenessIndicator";

interface SimpleApplicationCardProps {
	title: string;
	description: string;
	formType: string;
	illustration?: string;
	/** Where the guided questions for this form start, if the form has them */
	fillRoute?: string;
	/** Count completeness against this knowledge-base application instead of the PDF mapping */
	knowledgeApplicationId?: string;
}

/**
 * A minimal application card for form types that skip the guided wizard
 * (e.g. Bewohnerparkausweis, Wohngeld): unlike ApplicationCard, it doesn't
 * track a multi-step milestone — it just generates the filled PDF straight
 * from the current profile data. Its completeness indicator reflects only the
 * fields this specific form's mapping needs, not the broader Grundsicherung
 * milestone (which also requires document verification these forms don't).
 */
export const SimpleApplicationCard: React.FC<SimpleApplicationCardProps> = ({
	title,
	description,
	formType,
	illustration,
	fillRoute,
	knowledgeApplicationId,
}) => {
	const { t } = useTranslation("dashboard");
	const navigate = useNavigate();
	const { handleGenerate, isGenerating, error, modal } =
		useGeneratedPdfModal(formType);
	const mapping = useFormCompleteness(formType, {
		enabled: knowledgeApplicationId === undefined,
	});
	const knowledge = useKnowledgeCompleteness(knowledgeApplicationId);
	const level = knowledgeApplicationId ? knowledge.level : mapping.level;

	return (
		<div className="bg-white border border-brand-border-subtle rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
			<div className="flex flex-col gap-3 min-w-0 flex-1">
				<div className="flex flex-row justify-between gap-2 min-w-0 items-start">
					<h2 className="font-semibold text-brand-black text-h2 min-w-0 wrap-break-word pr-2 lg:text-xl/7">
						{title}
					</h2>
					{illustration && (
						<img
							src={illustration}
							alt=""
							className="max-w-24 max-h-24 shrink-0 lg:hidden"
							aria-hidden
						/>
					)}
				</div>
				<p className="text-brand-black text-body-lg leading-relaxed min-w-0 wrap-break-word">
					{description}
				</p>
			</div>

			<CompletenessIndicator level={level} />

			{error && (
				<p role="alert" className="text-sm text-rose-600 font-medium">
					{error}
				</p>
			)}

			{fillRoute && (
				<PrimaryButton
					onClick={() => navigate(fillRoute)}
					data-testid={`fill-${formType}-button`}
				>
					{t("sections.applications.fill_button", "Angaben ergänzen")}
				</PrimaryButton>
			)}

			<PrimaryButton
				onClick={() => void handleGenerate()}
				disabled={isGenerating}
				data-testid={`generate-${formType}-button`}
			>
				{isGenerating && (
					<Loader2 className="size-5 animate-spin mr-2 shrink-0" />
				)}
				{t("sections.applications.generate_button", "Antrag generieren")}
			</PrimaryButton>

			{modal}
		</div>
	);
};
