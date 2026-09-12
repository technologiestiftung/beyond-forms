import React from "react";
import type { TFunction } from "i18next";
import { PROFILE_CATEGORIES, type CategoryStatus } from "./categories";

const CATEGORY_STATUS_DOT: Record<CategoryStatus, string> = {
	COMPLETE: "bg-primary-green-500",
	PARTIAL: "bg-amber-500",
	MISSING: "bg-brand-border",
};

/** Shared with ProfileSectionCard's status pill so both read the same. */
const CATEGORY_STATUS_LABEL: Record<CategoryStatus, [string, string]> = {
	COMPLETE: ["status.complete", "Vollständig"],
	PARTIAL: ["status.partial", "Teilweise vollständig"],
	MISSING: ["status.missing", "Fehlt noch"],
};

export interface CategoryNavigationProps {
	activeCategoryId: string;
	categoryStatuses: Record<string, CategoryStatus>;
	onSelect: (categoryId: string) => void;
	t: TFunction;
}

/** Desktop-only sidebar */
export const CategoryNavigation: React.FC<CategoryNavigationProps> = ({
	activeCategoryId,
	categoryStatuses,
	onSelect,
	t,
}) => {
	const total = PROFILE_CATEGORIES.length;
	const completedCount = PROFILE_CATEGORIES.filter(
		(category) => categoryStatuses[category.id] === "COMPLETE",
	).length;

	return (
		<nav
			aria-label={t("personal.categories.nav_label", "Kategorien")}
			data-testid="profile-category-nav"
			className="hidden lg:flex lg:flex-col gap-5 self-start max-h-full overflow-y-auto bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
		>
			<div className="flex flex-col gap-2.5">
				<p
					id="profile-category-progress"
					className="text-sm font-semibold text-slate-900"
				>
					{t("personal.categories.progress", {
						completed: completedCount,
						total,
						defaultValue: `${completedCount} von ${total} Kategorien vollständig`,
					})}
				</p>
				<div
					role="progressbar"
					aria-labelledby="profile-category-progress"
					aria-valuenow={completedCount}
					aria-valuemin={0}
					aria-valuemax={total}
					className="h-2 w-full rounded-full bg-brand-border-subtle overflow-hidden"
				>
					<div
						className="h-full rounded-full bg-primary-blue-500 transition-all"
						style={{ width: `${(completedCount / total) * 100}%` }}
					/>
				</div>
			</div>

			<ul className="flex flex-col gap-0.5">
				{PROFILE_CATEGORIES.map((category) => {
					const isActive = category.id === activeCategoryId;
					const status = categoryStatuses[category.id] ?? "MISSING";
					const [statusKey, statusFallback] = CATEGORY_STATUS_LABEL[status];

					return (
						<li key={category.id}>
							<button
								type="button"
								onClick={() => onSelect(category.id)}
								aria-current={isActive ? "true" : undefined}
								data-testid={`category-nav-${category.id}`}
								className={`w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-primary ${
									isActive
										? "bg-brand-bg font-bold text-primary-blue-500"
										: "font-medium text-slate-800 hover:bg-brand-bg"
								}`}
							>
								<span
									className={`mt-1.5 size-2 shrink-0 rounded-full ${CATEGORY_STATUS_DOT[status]}`}
									aria-hidden="true"
								/>
								<span className="min-w-0 wrap-break-word">
									{t(category.labelKey, category.labelFallback)}
									{/* The dot alone encodes status by colour only. */}
									<span className="sr-only">
										{` (${t(statusKey, statusFallback)})`}
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
