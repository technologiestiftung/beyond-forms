import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldAlert, ChevronRight, X } from "lucide-react";
import { PageContainer } from "../../components/Layout/PageContainer";
import { AppRoutes } from "../../constants/routes";
import { DocumentStatusList } from "../../components/Application/DocumentStatusList";
import { useProfile } from "../../hooks/useProfile";
import { useIsDesktop } from "../../hooks/useIsDesktop";
import { Origins } from "../../constants/origin";
import { APPLICATION_DOCUMENT_GROUPS } from "../../config/applicationConfig";
import { DocumentsWorkspace } from "./documents/DocumentsWorkspace";
import {
	DOCUMENT_CATEGORY_ICONS,
	getCategoryDocumentCounts,
	EMPTY_CATEGORY_COUNT,
} from "./documents/categories";

export const DocumentsOverview: React.FC = () => {
	const { t } = useTranslation(["profile", "application"]);
	const navigate = useNavigate();
	const { documents, isLoading, isError, refetch } = useProfile({
		refetchOnMount: "always",
	});
	const isDesktop = useIsDesktop();
	const [activeCategoryId, setActiveCategoryId] = useState(
		APPLICATION_DOCUMENT_GROUPS[0].id,
	);
	const documentCounts = useMemo(
		() => getCategoryDocumentCounts(documents || []),
		[documents],
	);

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

	if (isError && (documents || []).length === 0) {
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
						onClick={() => void refetch()}
						className="h-12 px-8 bg-white border border-slate-200 text-slate-800 font-bold rounded-2xl shadow-sm active:scale-98 transition-all"
					>
						{t("common.retry", "Erneut versuchen")}
					</button>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			topBarProps={{
				onBack: () => navigate(AppRoutes.Profile),
				showLanguageSwitcher: true,
				className: "lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pt-4",
				rightElement: (
					<button
						type="button"
						onClick={() => navigate(AppRoutes.Profile)}
						aria-label={t("common.back", "Zurück")}
						className="w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-all"
					>
						<X className="w-5 h-5 text-slate-700" />
					</button>
				),
			}}
			contentClassName="lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pb-8 lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden"
			className="lg:h-full lg:min-h-0 lg:overflow-hidden"
		>
			<div className="w-full max-w-md mx-auto flex flex-col items-center px-2 gap-6 lg:max-w-none lg:items-start lg:px-0 lg:flex-1 lg:min-h-0">
				<div className="w-full flex flex-col gap-2 lg:gap-3 lg:shrink-0">
					<h1 className="text-h1 font-bold text-brand-black text-center lg:text-left lg:text-[32px] lg:leading-10">
						{t("sections.documents.title", "Meine Dokumente")}
					</h1>
					<p className="hidden lg:block text-body-lg text-brand-grey">
						{t(
							"sections.documents.subtitle",
							"Lade Deine Dokumente einmal hoch. Klaro verwendet sie dann für alle passenden Anträge.",
						)}
					</p>
				</div>

				{isDesktop ? (
					<DocumentsWorkspace
						activeCategoryId={activeCategoryId}
						documents={documents || []}
						onSelectCategory={setActiveCategoryId}
					>
						<DocumentStatusList
							documents={documents || []}
							showUnassigned={true}
							slotIds={[]}
							origin={Origins.HUB}
						/>
					</DocumentsWorkspace>
				) : (
					<div
						data-testid="documents-category-list"
						className="w-full flex flex-col gap-4 mt-2"
					>
						{APPLICATION_DOCUMENT_GROUPS.map((category) => {
							const CategoryIcon =
								DOCUMENT_CATEGORY_ICONS[category.id] || ShieldAlert;
							const { documentCount } =
								documentCounts[category.id] ?? EMPTY_CATEGORY_COUNT;

							return (
								<button
									key={category.id}
									type="button"
									onClick={() =>
										navigate(
											AppRoutes.ProfileDocumentsCategory.replace(
												":categoryId",
												category.id,
											),
										)
									}
									className="w-full bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-start gap-4 text-left hover:bg-slate-50/50 hover:border-slate-200 active:scale-98 transition-all group"
								>
									<div className="size-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0 group-hover:bg-white transition-all">
										<CategoryIcon className="size-5.5" />
									</div>

									<div className="flex flex-col gap-1 min-w-0 flex-1">
										<span className="text-body-lg font-extrabold text-slate-900 leading-snug">
											{t(category.titleKey, {
												ns: "application",
												defaultValue: category.defaultTitle,
											})}
										</span>
										<span className="text-xs text-brand-grey truncate leading-normal">
											{t(category.descriptionKey, {
												ns: "application",
												defaultValue: category.defaultDescription,
											})}
										</span>
										<span className="text-[10px] font-bold text-primary-blue-500 tracking-wide uppercase mt-1">
											{t("docs.selected_documents", {
												ns: "application",
												count: documentCount,
												defaultValue: `Ausgewählte Dokumente: ${documentCount}`,
											})}
										</span>
									</div>

									<div className="self-center shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors">
										<ChevronRight className="size-5 stroke-[2.5]" />
									</div>
								</button>
							);
						})}
					</div>
				)}

				{!isDesktop && (
					<div className="w-full mt-2">
						<DocumentStatusList
							documents={documents || []}
							showUnassigned={true}
							slotIds={[]}
							origin={Origins.HUB}
						/>
					</div>
				)}
			</div>
		</PageContainer>
	);
};
