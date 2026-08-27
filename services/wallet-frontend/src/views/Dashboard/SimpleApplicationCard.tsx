import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { useGenerateApplication } from "../../hooks/useGenerateApplication";
import { useFormCompleteness } from "../../hooks/useFormCompleteness";
import { CompletenessIndicator } from "../../components/Application/CompletenessIndicator";

interface SimpleApplicationCardProps {
	title: string;
	description: string;
	formType: string;
	illustration?: string;
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
}) => {
	const { t } = useTranslation("dashboard");
	const { generate, isGenerating, error } = useGenerateApplication(formType);
	const { level } = useFormCompleteness(formType);
	const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);

	const handleGenerate = async () => {
		setPdfUrl(null);
		const url = await generate();
		if (url) {
			setPdfUrl(url);
		}
	};

	return (
		<div className="bg-white border border-brand-border-subtle rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
			<div className="flex flex-col gap-3 min-w-0 flex-1">
				<div className="flex flex-row justify-between gap-2 min-w-0 items-start">
					<h2 className="font-semibold text-brand-black text-h2 min-w-0 wrap-break-word pr-2">
						{title}
					</h2>
					{illustration && (
						<img
							src={illustration}
							alt=""
							className="max-w-24 max-h-24 shrink-0"
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

			{pdfUrl ? (
				<a
					href={pdfUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center justify-center rounded-full w-full bg-primary-green-500 text-primary-blue-500 text-body-lg font-medium min-h-12 px-10 py-2.5 transition-colors hover:bg-primary-green-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue-500"
					data-testid={`open-${formType}-link`}
				>
					{t("sections.applications.open_button", "Antrag öffnen")}
				</a>
			) : (
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
			)}
		</div>
	);
};
