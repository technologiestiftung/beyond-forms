import React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Check } from "lucide-react";
import { useProfile } from "../../hooks/useProfile";
import { StatusPill, type StatusPillTone } from "../ui/StatusPill";
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
	completed?: boolean;
	started?: boolean;
	totalQuestions?: number;
	answeredQuestions?: number;
	badgeKey?: string;
	badge?: string;
	t: TFunction;
}

const ICON_POSITION = "lg:row-start-1 lg:row-span-2 lg:col-start-4";

const BADGE_POSITION =
	"flex items-center gap-2 mt-0.5 lg:row-start-1 lg:row-span-2 lg:col-start-3 lg:mt-0";

const StatusBadge: React.FC<StatusBadgeProps> = ({
	locked,
	completed,
	started,
	totalQuestions,
	answeredQuestions,
	badgeKey,
	badge,
	t,
}) => {
	if (locked) {
		return null;
	}

	let tone: StatusPillTone = "neutral";
	if (completed) {
		tone = "success";
	} else if (started) {
		tone = "warning";
	}

	if (totalQuestions !== undefined && answeredQuestions !== undefined) {
		return (
			<div className={BADGE_POSITION}>
				<StatusPill tone={tone} size="compact">
					{t(
						"questionnaire.questions_count",
						"Fragen: {{answered}}/{{total}}",
						{
							answered: answeredQuestions,
							total: totalQuestions,
						},
					)}
				</StatusPill>
			</div>
		);
	}

	if (badgeKey || badge) {
		return (
			<div className={BADGE_POSITION}>
				<StatusPill tone={tone} size="compact">
					{badgeKey ? t(badgeKey, badge ?? "") : badge}
				</StatusPill>
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
				className={`size-5 bg-primary-blue-500 rounded-full flex items-center justify-center text-white shrink-0 ${ICON_POSITION}`}
				data-testid="status-completed"
			>
				<Check className="size-3.5 stroke-[4]" />
			</div>
		);
	}
	if (started) {
		return (
			<div
				className={`size-5 border border-primary-blue-500 rounded-full flex items-center justify-center text-primary-blue-500 shrink-0 ${ICON_POSITION}`}
				data-testid="status-started"
			>
				<Check className="size-3.5 stroke-[4]" />
			</div>
		);
	}
	return (
		<div
			className={`size-5 border border-slate-300 rounded-full flex items-center justify-center text-slate-300 shrink-0 ${ICON_POSITION}`}
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
			className="flex flex-col gap-4 w-full min-w-0 max-w-md mx-auto lg:max-w-none"
			data-testid="questionnaire-status-list"
		>
			<div className="flex flex-col gap-4 w-full text-left">
				<div className="flex flex-col gap-4">
					{infoSections.length > 0 ? (
						infoSections.map((section) => {
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
										className="p-3.5 flex items-start gap-3 w-full text-left hover:bg-primary-blue-20/50 transition-colors lg:px-6 lg:py-5 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:items-center lg:gap-x-4 lg:gap-y-0.5"
									>
										<div className="size-12 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-lg bg-primary-blue-20 lg:row-start-1 lg:row-span-2 lg:col-start-1">
											<section.icon className="size-5 text-primary-blue-500" />
										</div>
										<div className="flex flex-col gap-1 pr-2 min-w-0 flex-1 lg:contents">
											<span className="text-body-lg font-semibold text-brand-black wrap-break-word lg:row-start-1 lg:col-start-2">
												{section.titleKey
													? t(section.titleKey, section.title)
													: section.title}
											</span>
											{section.subtitleKey || section.subtitle ? (
												<p className="text-xs text-brand-black leading-relaxed lg:row-start-2 lg:col-start-2 lg:self-start lg:max-w-[60ch] lg:text-body lg:text-brand-grey">
													{section.subtitleKey
														? t(section.subtitleKey, section.subtitle)
														: section.subtitle}
												</p>
											) : null}
											<StatusBadge
												locked={!!section.locked}
												completed={section.completed}
												started={section.started}
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
