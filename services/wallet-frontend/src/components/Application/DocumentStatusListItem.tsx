import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Trash2 } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import type { RequiredDocumentSlot } from "../../config/applicationConfig";
import {
	type WalletDocument,
	ProcessingStatusEnum,
} from "../../schemas/profile.schema";
import { CheckCircleIcon } from "../ui/Icons";
import { useProfile } from "../../hooks/useProfile";
import { ConfirmationModal } from "../ui/ConfirmationModal";
import { DocumentPreviewModal } from "../ui/DocumentPreviewModal";
import { type OriginType } from "../../constants/origin";

interface DocumentStatusListItemProps {
	slot: RequiredDocumentSlot & {
		matchedFiles: WalletDocument[];
		isVerified: boolean;
	};
	showDelete?: boolean;
	origin: OriginType;
}

export const DocumentStatusListItem = ({
	slot,
	showDelete = true,
	origin,
}: DocumentStatusListItemProps) => {
	const { t } = useTranslation("application");
	const navigate = useNavigate();
	const { deleteDocument } = useProfile();
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [previewDocId, setPreviewDocId] = useState<string | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const hasUploadedFile = slot.matchedFiles.length > 0;
	const uploadedFile = slot.matchedFiles[0];
	const isProcessing =
		hasUploadedFile &&
		(uploadedFile.status === ProcessingStatusEnum.enum.PROCESSING ||
			uploadedFile.status === ProcessingStatusEnum.enum.PENDING);
	const isVerified =
		slot.isVerified ||
		uploadedFile?.status === ProcessingStatusEnum.enum.VERIFIED;

	const handleClick = () => {
		if (isProcessing) {
			return;
		}
		if (hasUploadedFile) {
			// Prevent navigating to review screen if document OCR processing failed
			if (uploadedFile.status === ProcessingStatusEnum.enum.FAILED) {
				navigate(
					`${AppRoutes.ProfilePersonalDataUpload}?origin=${origin}&type=${slot.id}`,
				);
				return;
			}

			if (isVerified) {
				setPreviewDocId(uploadedFile.id);
			} else {
				navigate(
					`${AppRoutes.ProfileDocumentReview.replace(
						":documentId",
						uploadedFile.id,
					)}?origin=${origin}`,
				);
			}
		} else {
			navigate(
				`${AppRoutes.ProfilePersonalDataUpload}?origin=${origin}&type=${slot.id}`,
			);
		}
	};

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation(); // Prevent navigating to review page
		setShowDeleteModal(true);
	};

	const handleConfirmDelete = async () => {
		setShowDeleteModal(false);
		setDeleteError(null);
		try {
			await deleteDocument(uploadedFile.id);
		} catch (err) {
			console.error("Failed to delete document:", err);
			setDeleteError("Fehler beim Löschen des Dokuments.");
		}
	};

	const renderStatusIndicator = () => {
		if (isProcessing) {
			return (
				<span className="text-xs font-semibold text-secondary-orange-500 animate-pulse shrink-0">
					{t("docs.processing", "Verarbeitung...")}
				</span>
			);
		}
		if (uploadedFile?.status === ProcessingStatusEnum.enum.FAILED) {
			return (
				<span className="text-xs text-rose-500 font-bold shrink-0">
					{t("docs.failed", "Fehler")}
				</span>
			);
		}
		if (isVerified) {
			return <CheckCircleIcon className="size-5 text-primary-blue-500" />;
		}
		return (
			<ChevronRight className="size-5 text-brand-grey shrink-0 transition-transform duration-200" />
		);
	};

	return (
		<div className="w-full flex flex-col gap-1">
			{deleteError && (
				<div
					className="w-full bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-600 text-xs font-bold text-center animate-in fade-in"
					role="alert"
				>
					{deleteError}
				</div>
			)}
			<div className="flex items-center w-full bg-white rounded-xl border border-brand-border-subtle shadow-cards overflow-hidden gap-2 pr-2">
				<button
					type="button"
					onClick={isProcessing ? undefined : handleClick}
					disabled={isProcessing}
					data-testid={
						isVerified ? `preview-doc-btn-${slot.id}` : `slot-btn-${slot.id}`
					}
					className={`p-3.5 flex justify-between items-start flex-1 text-left min-w-0 transition-colors ${
						isProcessing ? "cursor-not-allowed" : "hover:bg-primary-blue-20/50"
					}`}
				>
					<div className="flex flex-col gap-1 pr-2 min-w-0 flex-1">
						<span
							data-testid={`slot-title-${slot.id}`}
							className="text-body-lg font-semibold text-brand-black wrap-break-word"
						>
							{t(slot.titleKey, slot.defaultTitle)}
						</span>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="px-2 py-0.5 bg-primary-blue-20 rounded-full text-xs text-slate-600">
								{t(slot.badgeKey, slot.defaultBadge)}
							</span>
						</div>
					</div>
					<div
						className="flex items-center gap-2 shrink-0 self-center"
						aria-live="polite"
					>
						{renderStatusIndicator()}
					</div>
				</button>

				{showDelete && hasUploadedFile && (
					<button
						type="button"
						onClick={handleDelete}
						data-testid={`delete-btn-${uploadedFile.id}`}
						className="p-2 hover:bg-rose-50 text-brand-grey hover:text-rose-600 rounded-lg transition-colors shrink-0"
						aria-label={t("docs.delete_aria", "Dokument löschen")}
					>
						<Trash2 className="size-4.5" />
					</button>
				)}

				<ConfirmationModal
					isOpen={showDeleteModal}
					title={t("docs.delete_title", "Dokument löschen?")}
					message={t(
						"docs.delete_confirm",
						"Möchtest Du dieses Dokument wirklich löschen?",
					)}
					confirmLabel={t("common.delete", "Löschen")}
					cancelLabel={t("common.cancel", "Abbrechen")}
					onConfirm={handleConfirmDelete}
					onCancel={() => setShowDeleteModal(false)}
				/>

				<DocumentPreviewModal
					isOpen={previewDocId !== null}
					documentId={previewDocId || ""}
					title={uploadedFile?.name || t(slot.titleKey, slot.defaultTitle)}
					onClose={() => setPreviewDocId(null)}
				/>
			</div>
		</div>
	);
};
