import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TutorialResponse } from "../../schemas/cms.schema";
import { DEFAULT_LOCALE } from "../../constants/locale";
import { AppRoutes } from "../../constants/routes";

function isTutorialValid(
	t: TutorialResponse,
): t is TutorialResponse & { slug: string } {
	return (
		typeof t.slug === "string" &&
		t.slug.length > 0 &&
		Array.isArray(t.steps) &&
		t.steps.length > 0
	);
}

export interface DashboardTutorialsProps {
	tutorials: TutorialResponse[];
	activeLanguage: string;
}

export const DashboardTutorials: React.FC<DashboardTutorialsProps> = ({
	tutorials,
	activeLanguage,
}) => {
	const { t } = useTranslation("dashboard");

	return (
		<div className="grid grid-cols-1 xs:grid-cols-2 gap-4 w-full text-white">
			{tutorials.filter(isTutorialValid).map((tutorial) => {
				const isCompleted = tutorial.progress?.status === "completed";
				const titleText =
					tutorial.title?.[activeLanguage] ||
					tutorial.title?.[DEFAULT_LOCALE] ||
					t("onboarding.checklist.tutorial.fallback_title");

				const subtitleText =
					tutorial.subtitle?.[activeLanguage] ||
					tutorial.subtitle?.[DEFAULT_LOCALE] ||
					t("onboarding.checklist.tutorial.subtitle_default");

				const to = AppRoutes.TutorialViewer.replace(":slug", tutorial.slug);
				const statusLabel = isCompleted
					? t("onboarding.checklist.status.done")
					: t("onboarding.checklist.status.pending");

				return (
					<Link
						key={tutorial.id}
						to={to}
						className="bg-primary-blue-500 p-5 rounded-2xl text-left flex flex-col justify-between shadow-sm no-underline text-white min-w-0 outline-none transition-colors hover:bg-primary-blue-500/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-blue-500"
						aria-label={t("onboarding.checklist.tutorial.aria_label", {
							title: titleText,
							subtitle: subtitleText,
							status: statusLabel,
						})}
					>
						<div className="min-w-0">
							<h3 className="font-bold leading-tight mb-1 wrap-break-word">
								{titleText}
							</h3>
							<p className="text-sm leading-relaxed wrap-break-word">
								{subtitleText}
							</p>
						</div>
						<span
							aria-hidden
							className={`pointer-events-none text-xs mt-2 size-fit font-semibold px-2.5 py-1 rounded-full ${isCompleted ? "bg-badge-done-muted text-badge-done" : "bg-badge-pending-muted  text-badge-pending"}`}
						>
							{statusLabel}
						</span>
					</Link>
				);
			})}
		</div>
	);
};
