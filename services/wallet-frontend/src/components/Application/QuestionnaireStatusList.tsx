import React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Check } from "lucide-react";
import { useProfile } from "../../hooks/useProfile";
import {
	getMappedInformationSections,
	getActiveSkippedCategories,
} from "../../utils/profile";

export interface QuestionnaireCategory {
	id: string;
	title: string;
	completed: boolean;
	totalQuestions: number;
	answeredQuestions: number;
}

interface QuestionnaireStatusListProps {
	categories?: QuestionnaireCategory[];
	onCategoryClick?: (id: string) => void;
}

interface StatusBadgeProps {
	locked: boolean;
	totalQuestions?: number;
	answeredQuestions?: number;
	badgeKey?: string;
	badge?: string;
	t: TFunction;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
	locked,
	totalQuestions,
	answeredQuestions,
	badgeKey,
	badge,
	t,
}) => {
	if (locked) {
		return null;
	}

	if (totalQuestions !== undefined && answeredQuestions !== undefined) {
		return (
			<div className="flex items-center gap-2 mt-0.5">
				<span className="px-3 py-0.5 bg-primary-blue-20 rounded-full text-[10px] font-bold text-primary-blue-500 tracking-wider">
					Fragen: {answeredQuestions}/{totalQuestions}
				</span>
			</div>
		);
	}

	if (badgeKey || badge) {
		return (
			<div className="flex items-center gap-2 mt-0.5">
				<span className="px-3 py-0.5 bg-primary-blue-20 rounded-full text-xs text-primary-green-800">
					{badgeKey ? t(badgeKey, badge ?? "") : badge}
				</span>
			</div>
		);
	}

	return null;
};

interface StatusIconProps {
	completed?: boolean;
	started?: boolean;
}

const StatusIcon: React.FC<StatusIconProps> = ({ completed, started }) => {
	if (completed) {
		return (
			<div
				className="size-5 bg-primary-blue-500 rounded-full flex items-center justify-center text-white shrink-0"
				data-testid="status-completed"
			>
				<Check className="size-3.5 stroke-[4]" />
			</div>
		);
	}
	if (started) {
		return (
			<div
				className="size-5 border border-primary-blue-500 rounded-full flex items-center justify-center text-primary-blue-500 shrink-0"
				data-testid="status-started"
			>
				<Check className="size-3.5 stroke-[4]" />
			</div>
		);
	}
	return (
		<div
			className="size-5 border border-slate-300 rounded-full flex items-center justify-center text-slate-300 shrink-0"
			data-testid="status-pending"
		>
			<Check className="size-3.5 stroke-[2]" />
		</div>
	);
};

export const QuestionnaireStatusList: React.FC<
	QuestionnaireStatusListProps
> = ({ onCategoryClick }) => {
	const { t } = useTranslation("application");
	const { profileData } = useProfile();

	const infoSections = getMappedInformationSections(profileData || {}, t).map(
		(section, index, arr) => {
			const completed = section.completed;
			const skipped = getActiveSkippedCategories(profileData || {});
			const locked =
				index > 0 &&
				arr
					.slice(0, index)
					.some(
						(prevSection) =>
							(prevSection.answeredQuestions || 0) === 0 &&
							!skipped.includes(prevSection.id),
					);
			const started = (section.answeredQuestions || 0) > 0 && !completed;
			return { ...section, completed, locked, started };
		},
	);

	return (
		<div
			className="flex flex-col gap-4 w-full min-w-0 max-w-md mx-auto"
			data-testid="questionnaire-status-list"
		>
			<div className="flex flex-col gap-4 w-full text-left">
				<div className="flex flex-col gap-4">
					{infoSections.length > 0 ? (
						infoSections.map((section) => {
							const isCompletedOrStarted = section.completed || section.started;
							const iconBgClass = isCompletedOrStarted
								? "bg-brand-muted-bright"
								: "bg-slate-100";
							const iconColorClass = isCompletedOrStarted
								? "text-primary-blue-500"
								: "text-brand-grey";

							return (
								<div
									key={section.id}
									className={`flex flex-col w-full bg-white rounded-3xl border border-brand-border-subtle shadow-cards overflow-hidden transition-all ${
										section.locked ? "opacity-70 pointer-events-none" : ""
									}`}
								>
									<button
										type="button"
										onClick={() => onCategoryClick?.(section.id)}
										className="p-3.5 flex items-start gap-3 w-full text-left hover:bg-primary-blue-20/50 transition-colors"
									>
										<div
											className={`size-12 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-lg ${iconBgClass}`}
										>
											<section.icon className={`size-5 ${iconColorClass}`} />
										</div>
										<div className="flex flex-col gap-1 pr-2 min-w-0 flex-1">
											<span className="text-body-lg font-semibold text-brand-black wrap-break-word">
												{section.titleKey
													? t(section.titleKey, section.title)
													: section.title}
											</span>
											{section.subtitleKey || section.subtitle ? (
												<p className="text-xs text-brand-black leading-relaxed">
													{section.subtitleKey
														? t(section.subtitleKey, section.subtitle)
														: section.subtitle}
												</p>
											) : null}
											<StatusBadge
												locked={!!section.locked}
												totalQuestions={section.totalQuestions}
												answeredQuestions={section.answeredQuestions}
												badgeKey={section.badgeKey}
												badge={section.badge}
												t={t}
											/>
										</div>
										<StatusIcon
											completed={section.completed}
											started={section.started}
										/>
									</button>
								</div>
							);
						})
					) : (
						<p className="text-center text-xs text-slate-500 font-medium py-8 px-4 bg-white rounded-3xl border border-brand-border-subtle shadow-cards">
							{t("questionnaire.empty", "Keine Informationen vorhanden")}
						</p>
					)}
				</div>
			</div>
		</div>
	);
};
