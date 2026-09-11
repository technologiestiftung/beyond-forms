import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { PageContainer } from "../../components/Layout/PageContainer";
import { DocumentStatusList } from "../../components/Application/DocumentStatusList";
import { AppRoutes } from "../../constants/routes";
import { Origins } from "../../constants/origin";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { useProfile } from "../../hooks/useProfile";
import { useIsDesktop } from "../../hooks/useIsDesktop";

import { APPLICATION_DOCUMENT_GROUPS } from "../../config/applicationConfig";
import { DocumentsWorkspace } from "./documents/DocumentsWorkspace";

export const CategoryDocumentsView: React.FC = () => {
	const { t } = useTranslation(["profile", "application"]);
	const navigate = useNavigate();
	const { categoryId } = useParams<{ categoryId: string }>();
	const { documents, isLoading, isError, refetch } = useProfile({
		refetchOnMount: "always",
	});
	const isDesktop = useIsDesktop();

	const group = APPLICATION_DOCUMENT_GROUPS.find((g) => g.id === categoryId);
	const activeCategory = group
		? {
				title: t(group.titleKey, {
					ns: "application",
					defaultValue: group.defaultTitle,
				}),
				description: t(group.descriptionKey, {
					ns: "application",
					defaultValue: group.defaultDescription,
				}),
				slotIds: group.slotIds,
			}
		: null;

	if (isLoading) {
		return (
			<PageContainer>
				<div
					className="w-full max-w-md flex flex-col items-center px-2 gap-6 pt-32"
					data-testid="documents-loading"
				>
					<div className="flex flex-col items-center gap-4">
						<div className="w-10 h-10 border-4 border-primary-blue-500 border-t-transparent rounded-full animate-spin" />
						<p className="text-brand-grey text-xs font-bold tracking-wider uppercase">
							{t("common.loading", "Lade...")}
						</p>
					</div>
				</div>
			</PageContainer>
		);
	}

	if (!activeCategory || (isError && (documents || []).length === 0)) {
		return (
			<PageContainer>
				<div className="w-full max-w-md flex flex-col items-center px-2 gap-6 pt-32 text-center">
					<h2 className="text-xl font-extrabold text-slate-900">
						{t("common.error_title", "Fehler")}
					</h2>
					<p className="text-brand-grey text-sm">
						{t("common.error_desc", "Fehler beim Laden der Dokumente.")}
					</p>
					<button
						type="button"
						onClick={() => {
							if (activeCategory) {
								void refetch();
							} else {
								navigate(AppRoutes.ProfileDocuments);
							}
						}}
						className="h-12 px-8 bg-white border border-slate-200 text-slate-800 font-bold rounded-2xl shadow-sm active:scale-98 transition-all"
					>
						{activeCategory
							? t("common.retry", "Erneut versuchen")
							: t("common.back", "Zurück")}
					</button>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			topBarProps={{
				onBack: () => navigate(AppRoutes.ProfileDocuments),
				showLanguageSwitcher: true,
				className: "lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pt-4",
				backAriaLabel: t("docs.back_to_overview_aria", {
					ns: "application",
					defaultValue: "Zurück zu meine Dokumente",
				}),
				rightElement: (
					<button
						type="button"
						onClick={() => navigate(AppRoutes.ProfileDocuments)}
						className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-all"
						aria-label={t("docs.close_aria", {
							ns: "application",
							defaultValue: "Schließen",
						})}
					>
						<X className="w-5 h-5 text-slate-700" />
					</button>
				),
			}}
			contentClassName="lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pb-8 lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden"
			className="lg:h-full lg:min-h-0 lg:overflow-hidden"
		>
			{isDesktop ? (
				<>
					<div className="flex w-full flex-col gap-3 shrink-0 mb-6">
						<h1 className="text-[32px] leading-10 font-bold text-brand-black">
							{t("sections.documents.title", "Meine Dokumente")}
						</h1>
						<p className="text-body-lg text-brand-grey">
							{t(
								"sections.documents.subtitle",
								"Lade Deine Dokumente einmal hoch. Klaro verwendet sie dann für alle passenden Anträge.",
							)}
						</p>
					</div>

					<DocumentsWorkspace
						activeCategoryId={categoryId ?? ""}
						documents={documents || []}
						onSelectCategory={(nextCategoryId) =>
							navigate(
								AppRoutes.ProfileDocumentsCategory.replace(
									":categoryId",
									nextCategoryId,
								),
								{ replace: true },
							)
						}
					/>
				</>
			) : (
				<div className="w-full max-w-md flex flex-col items-center px-2 gap-6">
					<div className="w-full text-left flex flex-col gap-1 mb-2 px-1">
						<h1 className="text-h1 font-bold text-brand-black leading-tight">
							{activeCategory.title}
						</h1>
						<p className="text-xs text-brand-grey leading-relaxed">
							{activeCategory.description}
						</p>
					</div>

					<PrimaryButton
						onClick={() =>
							navigate(
								`${AppRoutes.ProfilePersonalDataUpload}?origin=hub&category=${categoryId}`,
							)
						}
					>
						<span className="text-primary-blue-500">
							{t("docs.add_document", {
								ns: "application",
								defaultValue: "Dokument hinzufügen",
							})}
						</span>
					</PrimaryButton>
					<div className="w-full mt-2 flex flex-col gap-4">
						<DocumentStatusList
							documents={documents}
							slotIds={activeCategory.slotIds}
							showDelete={false}
							origin={Origins.HUB}
						/>
					</div>

					<button
						type="button"
						onClick={() => navigate(AppRoutes.ProfileDocuments)}
						className="w-full h-14 bg-white border border-slate-200 text-slate-800 font-bold rounded-2xl shadow-sm mt-8 active:scale-98 transition-all"
					>
						{t("common.back_to_overview", "Zurück zur Übersicht")}
					</button>
				</div>
			)}
		</PageContainer>
	);
};
