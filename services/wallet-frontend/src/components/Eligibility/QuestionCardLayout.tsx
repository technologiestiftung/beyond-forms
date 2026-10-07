import React from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { i18nKeys } from "../../i18n/i18nKeys";
import { PrimaryButton } from "../ui/PrimaryButton";

interface QuestionCardLayoutProps {
	id: string;
	category: string;
	tip?: string;
	canSubmit: boolean;
	onNext: () => void;
	/** Attach the tip to the whole group; otherwise the input links `${id}-tip` itself. */
	describeGroupWithTip?: boolean;
	children: React.ReactNode;
}

export const QuestionCardLayout: React.FC<QuestionCardLayoutProps> = ({
	id,
	category,
	tip,
	canSubmit,
	onNext,
	describeGroupWithTip = false,
	children,
}) => {
	const { t } = useTranslation();
	const tipId = `${id}-tip`;

	const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (canSubmit) {
			onNext();
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			data-testid="question-card"
			className="w-full font-sans flex flex-col justify-between flex-grow min-h-[360px]"
		>
			<fieldset
				className="w-full border-none p-0 m-0 flex flex-col gap-6 mb-8"
				aria-describedby={tip && describeGroupWithTip ? tipId : undefined}
			>
				<div className="flex flex-col gap-3">
					<p className="text-body text-brand-grey">
						{t(i18nKeys.eligibility.title)}
					</p>
					<h1 className="text-xl font-bold text-brand-black leading-snug">
						{category}
					</h1>
				</div>

				{tip && (
					<div
						id={tipId}
						className="bg-brand-bg border border-brand-border/40 rounded-xl p-4 flex gap-2 items-start"
					>
						<Info
							className="size-5 text-brand-grey shrink-0 mt-0.5"
							aria-hidden="true"
						/>
						<p className="text-base text-brand-grey leading-snug whitespace-pre-line">
							{tip}
						</p>
					</div>
				)}

				{children}
			</fieldset>

			<div className="w-full">
				<PrimaryButton
					type="submit"
					disabled={!canSubmit}
					data-testid="next-button"
				>
					{t(i18nKeys.common.next)}
				</PrimaryButton>
			</div>
		</form>
	);
};
