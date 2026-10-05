import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronDown, HelpCircle, XCircle } from "lucide-react";
import { BenefitStatus } from "../../schemas/benefitCheck.schema";
import type { BenefitAssessment } from "../../schemas/benefitCheck.schema";

interface BenefitAssessmentCardProps {
	assessment: BenefitAssessment;
	/** Where the per-benefit apply button points. Only rendered for a likely benefit. */
	applyPath: string;
}

/**
 * All three from lucide so the stroke weight matches. The repo's own CheckCircleIcon is a
 * filled shape and would sit oddly next to two outline glyphs.
 */
const STATUS_ICON: Record<
	BenefitStatus,
	React.ComponentType<{ className?: string }> | null
> = {
	[BenefitStatus.LIKELY_YES]: CheckCircle2,
	[BenefitStatus.CHECK_ADVISED]: HelpCircle,
	[BenefitStatus.LIKELY_NO]: XCircle,
	[BenefitStatus.NOT_APPLICABLE]: null,
};

/**
 * Icons and labels need different thresholds, so one token cannot serve both.
 *
 * A meaningful graphic has to clear 3:1, which these do on white (emerald-600 3.65,
 * amber-600 3.20, rose-500 3.75). Text has to clear 4.5:1, which none of them do — reusing
 * the icon tone on the 14px status label is what axe flagged at 3.65 and 3.19.
 *
 * Colour never carries the status alone: the label sits next to every icon.
 */
const STATUS_ICON_TONE: Record<BenefitStatus, string> = {
	[BenefitStatus.LIKELY_YES]: "text-emerald-600",
	[BenefitStatus.CHECK_ADVISED]: "text-amber-600",
	[BenefitStatus.LIKELY_NO]: "text-rose-500",
	[BenefitStatus.NOT_APPLICABLE]: "text-brand-grey",
};

/** One step darker, which is what carries these past 4.5:1 (5.36, 5.03, 6.03). */
const STATUS_TEXT_TONE: Record<BenefitStatus, string> = {
	[BenefitStatus.LIKELY_YES]: "text-emerald-700",
	[BenefitStatus.CHECK_ADVISED]: "text-amber-700",
	[BenefitStatus.LIKELY_NO]: "text-rose-700",
	[BenefitStatus.NOT_APPLICABLE]: "text-brand-grey",
};

/**
 * Green leads to the application, yellow to the check inside the app — being able to
 * check is what Klaro promises, so an uncertain verdict offers that rather than telling
 * people only an authority could work it out.
 */
const ACTION_LABEL_KEY: Partial<Record<BenefitStatus, string>> = {
	[BenefitStatus.LIKELY_YES]: "result.apply",
	[BenefitStatus.CHECK_ADVISED]: "result.check_now",
};

export const BenefitAssessmentCard: React.FC<BenefitAssessmentCardProps> = ({
	assessment,
	applyPath,
}) => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);
	const reasonsId = useId();

	const Icon = STATUS_ICON[assessment.status];
	const isMuted = assessment.status === BenefitStatus.NOT_APPLICABLE;
	const actionKey = ACTION_LABEL_KEY[assessment.status];
	const hasReasons = assessment.reasons.length > 0;

	const header = (
		<>
			{Icon && (
				<span data-testid="status-icon" className="shrink-0">
					<Icon className={`size-5 ${STATUS_ICON_TONE[assessment.status]}`} />
				</span>
			)}
			<span className="min-w-0 flex-1 text-left">
				<span className="block text-body-lg font-semibold text-brand-black wrap-break-word">
					{t(`result.benefit.${assessment.benefit}`)}
				</span>
				<span
					className={`block text-sm font-semibold ${STATUS_TEXT_TONE[assessment.status]}`}
				>
					{t(`result.status.${assessment.status}`)}
				</span>
			</span>
		</>
	);

	return (
		<li
			data-testid={`assessment-${assessment.benefit}`}
			data-muted={String(isMuted)}
			className={`w-full rounded-xl border border-brand-border-subtle bg-white shadow-cards ${
				isMuted ? "opacity-60" : ""
			}`}
		>
			{hasReasons ? (
				/**
				 * The header is the disclosure toggle. Tap, click and keyboard all work;
				 * hover would leave the reasons unreachable on a phone, which is what this
				 * view is sized for. aria-expanded lets a screen reader announce the state,
				 * so no separate label is needed.
				 */
				<button
					type="button"
					aria-expanded={isOpen}
					aria-controls={reasonsId}
					onClick={() => setIsOpen((open) => !open)}
					data-testid={`toggle-${assessment.benefit}`}
					className="flex w-full items-start gap-3 p-4 text-left"
				>
					{header}
					<ChevronDown
						aria-hidden="true"
						className={`size-5 shrink-0 text-brand-grey transition-transform ${
							isOpen ? "rotate-180" : ""
						}`}
					/>
				</button>
			) : (
				<div className="flex items-start gap-3 p-4">{header}</div>
			)}

			{hasReasons && isOpen && (
				<ul
					id={reasonsId}
					className="flex flex-col gap-1 list-none px-4 pb-4 pt-0 m-0"
				>
					{assessment.reasons.map((reason) => (
						<li key={reason} className="text-sm text-brand-grey">
							{t(`result.reason.${reason}`)}
						</li>
					))}
				</ul>
			)}

			{/*
			 * A sibling of the toggle, never inside it: nested interactive elements are
			 * invalid HTML and break keyboard navigation.
			 *
			 * TODO: the link is a placeholder. It sends people to account creation, which
			 * is a real next step but not benefit-specific; later this should deep-link to
			 * the check or the application for this benefit.
			 */}
			{actionKey && (
				<div className="px-4 pb-4">
					<Link
						to={applyPath}
						data-testid={`apply-${assessment.benefit}`}
						className="inline-block rounded-full bg-primary-blue-500 px-4 py-2 text-sm font-bold text-white"
					>
						{t(actionKey)}
					</Link>
				</div>
			)}
		</li>
	);
};
