import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { PrimaryButton } from "../ui/PrimaryButton";

interface PdfPreviewModalProps {
	isOpen?: boolean;
	onClose: () => void;
	pdfUrl: string | null;
	downloadUrl: string | null;
	downloadFilename: string;
	onDownloadSuccess: () => void;
	downloadButtonTestId?: string;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
	isOpen = true,
	onClose,
	pdfUrl,
	downloadUrl,
	downloadFilename,
	onDownloadSuccess,
	downloadButtonTestId = "download-pdf-button",
}) => {
	const { t } = useTranslation("application");
	const downloadAnchorRef = useRef<HTMLAnchorElement>(null);

	if (!isOpen) {
		return null;
	}

	const handleDownload = () => {
		if (!downloadUrl) {
			return;
		}
		const anchor = downloadAnchorRef.current;
		if (anchor) {
			anchor.href = downloadUrl;
			anchor.download = downloadFilename;
			anchor.click();
		}
		onDownloadSuccess();
	};

	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-110 flex items-center justify-center p-4 md:p-10 animate-fadeIn">
			<div
				role="dialog"
				aria-modal="true"
				className="bg-white rounded-3xl w-full max-w-3xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 animate-scaleUp"
			>
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
					<h3 className="font-bold text-slate-800 text-lg">
						{t("overview.preview_title", "Antragsentwurf Vorschau")}
					</h3>
					<button
						onClick={onClose}
						aria-label={t("overview.close_modal_button", "Schließen")}
						className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				<div className="flex-1 bg-slate-100 relative flex flex-col items-center justify-center">
					<iframe
						src={pdfUrl || ""}
						title="PDF Vorschau"
						className="w-full h-full border-none"
					/>
				</div>

				<div className="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0 bg-slate-50/30">
					<PrimaryButton
						onClick={handleDownload}
						className="w-full sm:w-auto"
						data-testid={downloadButtonTestId}
					>
						{t("overview.download_button", "Herunterladen")}
					</PrimaryButton>
				</div>

				{/* Hidden anchor used to trigger cross-browser-safe downloads synchronously from a user click */}
				<a
					ref={downloadAnchorRef}
					className="hidden"
					aria-hidden="true"
					tabIndex={-1}
					data-testid="download-pdf-anchor"
				/>
			</div>
		</div>
	);
};
