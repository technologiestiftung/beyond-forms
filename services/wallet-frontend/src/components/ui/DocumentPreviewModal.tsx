import React, { useEffect, useRef, useState } from "react";
import { X, Download, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fileService } from "../../services/profile/FileService";
import { DocumentNotFoundError } from "../../errors/DocumentNotFoundError";

export interface DocumentPreviewModalProps {
	isOpen: boolean;
	documentId: string;
	title?: string;
	onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
	isOpen,
	documentId,
	title,
	onClose,
}) => {
	const { t } = useTranslation("profile");
	const displayTitle =
		title || t("documents.preview_title", "Dokument-Vorschau");
	const modalRef = useRef<HTMLDivElement>(null);
	const blobUrlRef = useRef<string | null>(null);
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [mimeType, setMimeType] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
	const [prevDocumentId, setPrevDocumentId] = useState(documentId);

	// 1. Reset state synchronously when closed to prevent the flickering stale-render bug
	if (isOpen !== prevIsOpen) {
		setPrevIsOpen(isOpen);
		if (!isOpen) {
			setBlobUrl(null);
			setMimeType(null);
			setIsLoading(true);
			setError(null);
		}
	}

	if (documentId !== prevDocumentId) {
		setPrevDocumentId(documentId);
		if (isOpen) {
			setIsLoading(true);
		}
	}

	// Clean up blob URL when closed
	useEffect(() => {
		if (!isOpen && blobUrlRef.current) {
			URL.revokeObjectURL(blobUrlRef.current);
			blobUrlRef.current = null;
		}
	}, [isOpen]);

	// Global cleanup
	useEffect(() => {
		return () => {
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}
		};
	}, []);

	// Fetch Blob Lifecycle
	useEffect(() => {
		if (!isOpen || !documentId) {
			return () => {};
		}

		let isActive = true;
		const controller = new AbortController();

		fileService
			.getFileBlob(documentId, controller.signal)
			.then(({ blob, mimeType: resolvedMime }) => {
				if (!isActive) {
					return;
				}
				const url = URL.createObjectURL(blob);
				blobUrlRef.current = url;
				setBlobUrl(url);
				setMimeType(resolvedMime);
				setIsLoading(false);
			})
			.catch((err: unknown) => {
				if (!isActive) {
					return;
				}
				if (err instanceof Error && err.name === "AbortError") {
					return;
				}
				if (err instanceof DocumentNotFoundError) {
					setError(
						t(
							"documents.errors.previewUnavailableDueToTTL",
							"Dieses Dokument ist aus Datenschutzgründen oder durch automatische Speicherfristen nicht mehr als Live-Vorschau verfügbar. Deine verifizierten Daten sind jedoch weiterhin sicher in deinem Profil gespeichert.",
						),
					);
				} else {
					setError(
						t(
							"documents.errors.loadFailed",
							"Fehler beim Laden des Dokuments.",
						),
					);
				}
				setIsLoading(false);
			});

		return () => {
			isActive = false;
			controller.abort();
		};
	}, [isOpen, documentId, t]);

	// Escape Key Global Listener
	useEffect(() => {
		if (!isOpen) {
			return () => {};
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onClose]);

	// Focus Trapping
	useEffect(() => {
		if (!isOpen) {
			return () => {};
		}

		const modalElement = modalRef.current;
		if (!modalElement) {
			return () => {};
		}

		const focusableSelectors =
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
		const focusableElements =
			modalElement.querySelectorAll<HTMLElement>(focusableSelectors);
		const firstFocusable = focusableElements[0];
		const lastFocusable = focusableElements[focusableElements.length - 1];

		if (firstFocusable) {
			firstFocusable.focus();
		}

		const handleTabKey = (e: KeyboardEvent) => {
			if (e.key !== "Tab") {
				return;
			}

			if (e.shiftKey) {
				if (document.activeElement === firstFocusable) {
					lastFocusable?.focus();
					e.preventDefault();
				}
			} else if (document.activeElement === lastFocusable) {
				firstFocusable?.focus();
				e.preventDefault();
			}
		};

		modalElement.addEventListener("keydown", handleTabKey);
		return () => {
			modalElement.removeEventListener("keydown", handleTabKey);
		};
	}, [isOpen, isLoading]);

	if (!isOpen) {
		return null;
	}

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	const isPdf = mimeType?.includes("pdf");

	return (
		<div
			onClick={handleBackdropClick}
			className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
		>
			<div
				ref={modalRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="preview-modal-title"
				className="bg-white w-full max-w-2xl rounded-[28px] p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 animate-in zoom-in-95 duration-300 relative max-h-[90vh]"
			>
				{/* Top Header Bar */}
				<div className="flex items-center justify-between border-b border-slate-100 pb-3">
					<h3
						id="preview-modal-title"
						className="text-lg font-extrabold text-slate-900 truncate pr-4"
					>
						{displayTitle}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="size-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center active:scale-90 transition-all shrink-0"
						aria-label={t("common.close", "Schließen")}
					>
						<X className="w-4 h-4 text-slate-500" />
					</button>
				</div>

				{/* Content Area */}
				<div className="w-full flex-1 overflow-auto flex items-center justify-center min-h-[40vh]">
					{isLoading && (
						<div
							className="flex flex-col items-center gap-3 py-12"
							data-testid="preview-loading-spinner"
						>
							<div className="size-10 border-4 border-primary-blue-500 border-t-transparent rounded-full animate-spin" />
							<p className="text-xs font-bold text-brand-grey uppercase tracking-wider">
								{t(
									"documents.errors.loading_document",
									"Dokument wird geladen...",
								)}
							</p>
						</div>
					)}

					{error && !isLoading && (
						<div className="flex flex-col items-center gap-3 py-12 text-center">
							<div className="size-14 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
								<AlertCircle className="size-7" />
							</div>
							<p className="text-sm font-bold text-slate-800">{error}</p>
						</div>
					)}

					{!isLoading && !error && blobUrl && (
						<div className="w-full h-full flex items-center justify-center">
							{isPdf ? (
								<iframe
									data-testid="document-preview-iframe"
									src={`${blobUrl}#toolbar=0`}
									title={t("documents.pdf_preview_title", "PDF Vorschau")}
									className="w-full h-[65vh] rounded-2xl border border-slate-200 shadow-inner"
								/>
							) : (
								<img
									data-testid="document-preview-image"
									src={blobUrl}
									alt={displayTitle}
									className="w-full max-h-[65vh] object-contain rounded-2xl p-1"
								/>
							)}
						</div>
					)}
				</div>

				{/* Footer CTA Buttons */}
				<div className="flex items-center gap-3 border-t border-slate-100 pt-3">
					{!isLoading && !error && blobUrl && (
						<a
							href={blobUrl}
							download={displayTitle || "dokument.pdf"}
							className="h-12 px-6 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-2xl shadow-sm active:scale-98 transition-all flex items-center justify-center gap-2 text-sm shrink-0"
						>
							<Download className="size-4.5" />
							<span>{t("common.download", "Herunterladen")}</span>
						</a>
					)}
					<button
						type="button"
						onClick={onClose}
						data-testid="preview-close-button"
						className="w-full h-12 bg-primary-blue-500 hover:bg-primary-blue-600 active:bg-primary-blue-700 text-white font-bold rounded-2xl shadow-md active:scale-98 transition-all flex items-center justify-center text-sm flex-1"
					>
						{t("common.close", "Schließen")}
					</button>
				</div>
			</div>
		</div>
	);
};
