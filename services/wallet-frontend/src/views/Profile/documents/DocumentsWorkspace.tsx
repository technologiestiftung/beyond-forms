import React, { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { APPLICATION_DOCUMENT_GROUPS } from "../../../config/applicationConfig";
import { AppRoutes } from "../../../constants/routes";
import { Origins } from "../../../constants/origin";
import { DocumentStatusList } from "../../../components/Application/DocumentStatusList";
import type { WalletDocument } from "../../../schemas/profile.schema";
import { usePendingUploadStore } from "../../../store/usePendingUploadStore";
import { DocumentCategoryNavigation } from "./DocumentCategoryNavigation";
import { DocumentDropTarget } from "./DocumentDropTarget";
import { getCategoryDocumentCounts } from "./categories";

export interface DocumentsWorkspaceProps {
	activeCategoryId: string;
	documents: WalletDocument[];
	onSelectCategory: (categoryId: string) => void;
	/** Rendered below the detail card, inside the scrolling column. */
	children?: React.ReactNode;
}

export const DocumentsWorkspace: React.FC<DocumentsWorkspaceProps> = ({
	activeCategoryId,
	documents,
	onSelectCategory,
	children,
}) => {
	const { t } = useTranslation(["profile", "application"]);
	const navigate = useNavigate();
	const location = useLocation();

	// The carried location keeps this view rendered underneath the flow's dialog.
	const openFlow = useCallback(
		(path: string) => {
			navigate(path, { state: { backgroundLocation: location } });
		},
		[location, navigate],
	);

	const categoryCounts = useMemo(
		() => getCategoryDocumentCounts(documents),
		[documents],
	);

	const activeCategory =
		APPLICATION_DOCUMENT_GROUPS.find(
			(category) => category.id === activeCategoryId,
		) || APPLICATION_DOCUMENT_GROUPS[0];
	const uploadRoute = `${AppRoutes.ProfilePersonalDataUpload}?origin=${Origins.HUB}&category=${activeCategory.id}`;

	const handleDroppedFile = (file: File) => {
		usePendingUploadStore.getState().setPendingFile(file);
		openFlow(uploadRoute);
	};

	return (
		<div
			data-testid="documents-workspace"
			className="hidden w-full lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-8 lg:flex-1 lg:min-h-0"
		>
			<DocumentCategoryNavigation
				activeCategoryId={activeCategory.id}
				categoryCounts={categoryCounts}
				onSelect={onSelectCategory}
				t={t}
			/>

			<div className="flex flex-col gap-5 min-w-0 min-h-0 overflow-y-auto">
				<div className="bg-white rounded-2xl border border-brand-border-subtle shadow-cards p-8 flex flex-col gap-6 min-w-0">
					<div className="flex flex-col gap-5">
						<div className="flex flex-col gap-1">
							<h2 className="text-h2 font-bold text-brand-black wrap-break-word">
								{t(activeCategory.titleKey, {
									ns: "application",
									defaultValue: activeCategory.defaultTitle,
								})}
							</h2>
							<p className="text-brand-grey">
								{t(activeCategory.descriptionKey, {
									ns: "application",
									defaultValue: activeCategory.defaultDescription,
								})}
							</p>
						</div>

						<DocumentDropTarget
							onFile={handleDroppedFile}
							onOpen={() => openFlow(uploadRoute)}
							t={t}
						/>
					</div>

					<DocumentStatusList
						documents={documents}
						slotIds={activeCategory.slotIds}
						showDelete={false}
						origin={Origins.HUB}
						variant="row"
						onOpenFlow={openFlow}
					/>
				</div>

				{children}
			</div>
		</div>
	);
};
