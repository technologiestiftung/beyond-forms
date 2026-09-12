import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { PdfPreviewModal } from "../../components/Application/PdfPreviewModal";
import {
	useGenerateApplication,
	type GeneratedApplication,
} from "../../hooks/useGenerateApplication";
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
	const [application, setApplication] =
		React.useState<GeneratedApplication | null>(null);
	const [showPreviewModal, setShowPreviewModal] = React.useState(false);

	const handleGenerate = async () => {
		const result = await generate();
		if (result) {
			setApplication(result);
			setShowPreviewModal(true);
		}
	};

	const closePreview = () => {
		setShowPreviewModal(false);
		if (application?.openUrl.startsWith("blob:")) {
			URL.revokeObjectURL(application.openUrl);
		}
		setApplication(null);
	};

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

			{showPreviewModal && application && (
				<PdfPreviewModal
					key={application.downloadUrl}
					onClose={closePreview}
					pdfUrl={application.openUrl}
					downloadUrl={application.downloadUrl}
					downloadFilename={application.filename}
					onDownloadSuccess={closePreview}
					downloadButtonTestId={`download-${formType}-button`}
				/>
			)}
		</div>
	);
};
