import React from "react";
import { PdfPreviewModal } from "../components/Application/PdfPreviewModal";
import {
	useGenerateApplication,
	type GeneratedApplication,
} from "./useGenerateApplication";

export interface UseGeneratedPdfModalOptions {
	downloadButtonTestId?: string;
}

/**
 * Generates a filled application PDF and manages preview modal state + blob cleanup.
 */
export function useGeneratedPdfModal(
	formType: string,
	options?: UseGeneratedPdfModalOptions,
) {
	const { generate, isGenerating, error } = useGenerateApplication(formType);
	const [application, setApplication] =
		React.useState<GeneratedApplication | null>(null);
	const [showPreviewModal, setShowPreviewModal] = React.useState(false);

	const downloadButtonTestId =
		options?.downloadButtonTestId ?? `download-${formType}-button`;

	const closePreview = () => {
		setShowPreviewModal(false);
		if (application?.openUrl.startsWith("blob:")) {
			URL.revokeObjectURL(application.openUrl);
		}
		setApplication(null);
	};

	const handleGenerate = async () => {
		const result = await generate();
		if (result) {
			setApplication(result);
			setShowPreviewModal(true);
		}
	};

	const modal =
		showPreviewModal && application
			? (
					<PdfPreviewModal
						key={application.downloadUrl}
						onClose={closePreview}
						pdfUrl={application.openUrl}
						downloadUrl={application.downloadUrl}
						downloadFilename={application.filename}
						onDownloadSuccess={closePreview}
						downloadButtonTestId={downloadButtonTestId}
					/>
				)
			: null;

	return { handleGenerate, isGenerating, error, modal };
}
