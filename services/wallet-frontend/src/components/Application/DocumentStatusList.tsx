import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import {
	type WalletDocument,
	ProcessingStatusEnum,
} from "../../schemas/profile.schema";
import {
	REQUIRED_DOCUMENT_SLOTS,
	APPLICATION_DOCUMENT_GROUPS,
} from "../../config/applicationConfig";
import { AppRoutes } from "../../constants/routes";
import { DocumentStatusListItem } from "./DocumentStatusListItem";
import {
	doesDocumentMatchSlot,
	sanitizeFileName,
	getActiveDocumentSlots,
} from "../../utils/profile";
import { useProfile } from "../../hooks/useProfile";
import { ConfirmationModal } from "../ui/ConfirmationModal";
import { type OriginType, Origins } from "../../constants/origin";
import { formatDateString } from "../../utils/date";

interface DocumentStatusListProps {
	documents: WalletDocument[];
	filterMode?: "open" | "done";
	slotIds?: string[];
	showUnassigned?: boolean;
	showDelete?: boolean;
	origin?: OriginType;
}

export const DocumentStatusList: React.FC<DocumentStatusListProps> = ({
	documents = [],
	filterMode,
	slotIds,
	showUnassigned = false,
	showDelete = true,
	origin = Origins.WIZARD,
}) => {
	const { t } = useTranslation("application");
	const navigate = useNavigate();
	const { deleteDocument, profileData } = useProfile();
	const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

	const isStandalone = filterMode === undefined;

	const targetSlots =
		origin === Origins.WIZARD
			? getActiveDocumentSlots(profileData || {})
			: REQUIRED_DOCUMENT_SLOTS;

	const processedSlots = targetSlots.map((slot) => {
		const matchedFiles = documents.filter((d) =>
			doesDocumentMatchSlot(d, slot),
		);
		return {
			...slot,
			matchedFiles,
			isVerified: matchedFiles.some(
				(m) => m.status === ProcessingStatusEnum.enum.VERIFIED,
			),
		};
	});

	const unassignedFiles = documents.filter((d) => {
		const matchesAnySlot = targetSlots.some((slot) =>
			doesDocumentMatchSlot(d, slot),
		);
		return !matchesAnySlot && d.status !== ProcessingStatusEnum.enum.VERIFIED;
	});

	const handleConfirmDelete = async () => {
		if (!deleteDocId) {
			return;
		}
		try {
			await deleteDocument(deleteDocId);
		} catch (err) {
			console.error("Failed to delete document:", err);
		} finally {
			setDeleteDocId(null);
		}
	};

	const visibleSlots = isStandalone
		? processedSlots
		: processedSlots.filter((s) =>
				filterMode === "done" ? s.isVerified : !s.isVerified,
			);

	const renderUnassignedSection = () => {
		if (!showUnassigned || unassignedFiles.length === 0) {
			return null;
		}
		return (
			<div className="mt-4 flex flex-col gap-2 w-full text-left">
				<h4 className="text-brand-black font-semibold text-body-lg mb-2">
					{t("docs.unsorted_title", "Kürzlich hochgeladene Dokumente")}
				</h4>
				<div className="flex flex-col bg-white rounded-xl border border-brand-border-subtle shadow-cards overflow-hidden">
					{unassignedFiles.map((file) => (
						<div
							key={file.id}
							className="p-3.5 flex items-center justify-between text-left gap-3 hover:bg-primary-blue-20/50 transition-colors min-w-0 w-full border-b border-brand-border-subtle last:border-none"
						>
							<div className="flex flex-col gap-0.5 min-w-0 flex-1">
								<div className="flex items-center gap-2 min-w-0 w-full">
									<span
										className="text-body-lg font-semibold text-brand-black truncate block w-full"
										title={file.name}
										aria-label={file.name}
									>
										{file.name
											? sanitizeFileName(file.name)
											: t("docs.untitled", "Unbenanntes Dokument")}
									</span>
								</div>
								<span className="text-xs text-brand-grey font-medium">
									{formatDateString(file.uploadDate)}
								</span>
							</div>
							<div
								className="flex items-center gap-2 shrink-0"
								aria-live="polite"
							>
								{file.status === ProcessingStatusEnum.enum.PROCESSING ||
								file.status === ProcessingStatusEnum.enum.PENDING ? (
									<span className="h-8 px-3 flex items-center justify-center bg-secondary-orange-20 border border-secondary-orange-500/30 text-secondary-orange-800 font-bold rounded-full text-[10px] tracking-wider uppercase select-none animate-pulse shrink-0">
										{t("docs.processing", "Verarbeitung...")}
									</span>
								) : (
									<button
										type="button"
										onClick={() =>
											navigate(
												`${AppRoutes.ProfileDocumentReview.replace(
													":documentId",
													file.id,
												)}?origin=${origin}`,
											)
										}
										className="h-8 px-3.5 bg-primary-blue-500 text-white font-bold rounded-full text-xs shadow-sm hover:opacity-90 active:scale-95 transition-all"
									>
										{t("docs.review", "Prüfen")}
									</button>
								)}

								<button
									type="button"
									onClick={() => setDeleteDocId(file.id)}
									data-testid={`delete-btn-${file.id}`}
									className="p-2 hover:bg-status-error-bg text-brand-grey hover:text-status-error rounded-lg transition-colors shrink-0"
									aria-label={t("docs.delete_aria", "Dokument löschen")}
								>
									<Trash2 className="size-4.5" />
								</button>
							</div>
						</div>
					))}
				</div>
				<ConfirmationModal
					isOpen={deleteDocId !== null}
					title={t("docs.delete_title", "Dokument löschen?")}
					message={t(
						"docs.delete_confirm",
						"Möchtest Du dieses Dokument wirklich löschen?",
					)}
					confirmLabel={t("common.delete", "Löschen")}
					cancelLabel={t("common.cancel", "Abbrechen")}
					onConfirm={handleConfirmDelete}
					onCancel={() => setDeleteDocId(null)}
				/>
			</div>
		);
	};

	// Early return for category accordions (HUB origin)
	if (slotIds && !showUnassigned) {
		const filteredSlots = visibleSlots.filter((s) => slotIds.includes(s.id));
		return (
			<div
				className="flex flex-col gap-4 w-full min-w-0 max-w-md mx-auto"
				data-testid="document-status-list"
			>
				{filteredSlots.flatMap((slot) => {
					if (slot.matchedFiles.length === 0) {
						return [
							<DocumentStatusListItem
								key={slot.id}
								slot={slot}
								showDelete={showDelete}
								origin={origin}
							/>,
						];
					}
					return slot.matchedFiles.map((file, index) => (
						<DocumentStatusListItem
							key={`${slot.id}-${file.id || index}`}
							slot={{
								...slot,
								matchedFiles: [file],
							}}
							showDelete={showDelete}
							origin={origin}
						/>
					));
				})}
			</div>
		);
	}

	// Early return for unassigned dashboard triage views
	if (slotIds && slotIds.length === 0 && showUnassigned) {
		return renderUnassignedSection();
	}

	return (
		<div
			className="flex flex-col gap-6 w-full min-w-0 max-w-md mx-auto"
			data-testid="document-status-list"
		>
			{/* Thematic Grouping */}
			<div className="flex flex-col gap-8">
				{APPLICATION_DOCUMENT_GROUPS.map((group) => {
					const groupSlots = visibleSlots.filter((s) =>
						group.slotIds.includes(s.id),
					);
					if (groupSlots.length === 0) {
						return null;
					}

					return (
						<div
							key={group.id}
							className="flex flex-col gap-3 w-full text-left"
						>
							<h4 className="text-brand-black font-semibold text-body-lg mb-2">
								{t(group.titleKey, group.defaultTitle)}
							</h4>

							<div className="flex flex-col gap-4">
								{groupSlots.flatMap((slot) => {
									if (slot.matchedFiles.length === 0) {
										return [
											<DocumentStatusListItem
												key={slot.id}
												slot={slot}
												showDelete={showDelete}
												origin={origin}
											/>,
										];
									}
									return slot.matchedFiles.map((file, index) => (
										<DocumentStatusListItem
											key={`${slot.id}-${file.id || index}`}
											slot={{
												...slot,
												matchedFiles: [file],
											}}
											showDelete={showDelete}
											origin={origin}
										/>
									));
								})}
							</div>
						</div>
					);
				})}

				{renderUnassignedSection()}
			</div>
		</div>
	);
};
