import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
	ShieldAlert,
	Coins,
	Home,
	FileCheck,
	ChevronRight,
	X,
} from "lucide-react";
import { PageContainer } from "../../components/Layout/PageContainer";
import { AppRoutes } from "../../constants/routes";
import { DocumentStatusList } from "../../components/Application/DocumentStatusList";
import { useProfile } from "../../hooks/useProfile";
import { Origins } from "../../constants/origin";
import {
	APPLICATION_DOCUMENT_GROUPS,
	REQUIRED_DOCUMENT_SLOTS,
} from "../../config/applicationConfig";
import { doesDocumentMatchSlot } from "../../utils/profile";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
	identity: ShieldAlert,
	income: Coins,
	housing: Home,
	declarations: FileCheck,
};

export const DocumentsOverview: React.FC = () => {
	const { t } = useTranslation(["profile", "application"]);
	const navigate = useNavigate();
	const { documents, isLoading, isError, refetch } = useProfile({
		refetchOnMount: "always",
	});
	const documentCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		APPLICATION_DOCUMENT_GROUPS.forEach((category) => {
			const categorySlots = REQUIRED_DOCUMENT_SLOTS.filter((s) =>
				category.slotIds.includes(s.id),
			);
			counts[category.id] = (documents || []).filter((d) =>
				categorySlots.some((slot) => doesDocumentMatchSlot(d, slot)),
			).length;
		});
		return counts;
	}, [documents]);

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
				rightElement: (
					<button
						type="button"
						onClick={() => navigate(AppRoutes.Profile)}
						aria-label={t("common.back", "Zurück")}
						className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-all"
					>
						<X className="w-5 h-5 text-slate-700" />
					</button>
				),
			}}
		>
			<div className="w-full max-w-md flex flex-col items-center px-2 gap-6	">
				<h1 className="text-h1 font-bold text-brand-black">
					{t("sections.documents.title", "Meine Dokumente")}
				</h1>
				<div className="w-full flex flex-col gap-4 mt-2">
					{APPLICATION_DOCUMENT_GROUPS.map((category) => {
						const CategoryIcon = CATEGORY_ICONS[category.id] || ShieldAlert;
						const matchedCount = documentCounts[category.id] || 0;

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
								{/* Topic Icon Container */}
								<div className="size-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0 group-hover:bg-white transition-all">
									<CategoryIcon className="size-5.5" />
								</div>

								{/* Text info details */}
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
											count: matchedCount,
											defaultValue: `Ausgewählte Dokumente: ${matchedCount}`,
										})}
									</span>
								</div>

								{/* Chevron link */}
								<div className="self-center shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors">
									<ChevronRight className="size-5 stroke-[2.5]" />
								</div>
							</button>
						);
					})}
				</div>

				<div className="w-full mt-2">
					<DocumentStatusList
						documents={documents || []}
						showUnassigned={true}
						slotIds={[]}
						origin={Origins.HUB}
					/>
				</div>
			</div>
		</PageContainer>
	);
};
