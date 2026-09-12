import React from "react";
import type { TFunction } from "i18next";
import { ShieldAlert } from "lucide-react";
import { APPLICATION_DOCUMENT_GROUPS } from "../../../config/applicationConfig";
import {
	DOCUMENT_CATEGORY_ICONS,
	EMPTY_CATEGORY_COUNT,
	type CategoryDocumentCount,
} from "./categories";

export interface DocumentCategoryNavigationProps {
	activeCategoryId: string;
	categoryCounts: Record<string, CategoryDocumentCount>;
	onSelect: (categoryId: string) => void;
	t: TFunction;
}

export const DocumentCategoryNavigation: React.FC<
	DocumentCategoryNavigationProps
> = ({ activeCategoryId, categoryCounts, onSelect, t }) => {
	return (
		<nav
			aria-label={t("docs.categories_nav_label", {
				ns: "application",
				defaultValue: "Dokumentkategorien",
			})}
			data-testid="document-category-nav"
			className="self-start max-h-full overflow-y-auto bg-white rounded-2xl border border-brand-border-subtle shadow-cards p-3"
		>
			<ul className="flex flex-col gap-1">
				{APPLICATION_DOCUMENT_GROUPS.map((category) => {
					const CategoryIcon =
						DOCUMENT_CATEGORY_ICONS[category.id] || ShieldAlert;
					const isActive = category.id === activeCategoryId;
					const { documentCount } =
						categoryCounts[category.id] ?? EMPTY_CATEGORY_COUNT;

					return (
						<li key={category.id}>
							<button
								type="button"
								onClick={() => onSelect(category.id)}
								aria-current={isActive ? "true" : undefined}
								data-testid={`document-category-nav-${category.id}`}
								className={`w-full flex items-center gap-3.5 rounded-xl p-3 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-primary ${
									isActive ? "bg-brand-bg" : "hover:bg-brand-bg"
								}`}
							>
								<span
									className={`size-11 shrink-0 rounded-xl border border-brand-border flex items-center justify-center text-primary-blue-500 ${
										isActive ? "bg-primary-green-500" : "bg-brand-bg"
									}`}
									aria-hidden="true"
								>
									<CategoryIcon className="size-6" />
								</span>
								<span className="flex flex-col gap-0.5 min-w-0 flex-1">
									<span
										className={`font-bold wrap-break-word ${isActive ? "text-primary-blue-500" : "text-brand-black"}`}
									>
										{t(category.titleKey, {
											ns: "application",
											defaultValue: category.defaultTitle,
										})}
									</span>
									<span className="text-sm text-brand-grey">
										{t("docs.category_document_count", {
											ns: "application",
											count: documentCount,
											defaultValue: `${documentCount} Dokumente`,
										})}
									</span>
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</nav>
	);
};
