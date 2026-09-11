import React from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { i18nKeys } from "../../i18n/i18nKeys";
import { PrimaryButton } from "../ui/PrimaryButton";

/** The header, tip and submit button every question screen shares. */
export interface QuestionHeader {
	id: string;
	question: string;
	category: string;
	tip?: string;
}

interface QuestionShellProps extends QuestionHeader {
	/** False while the question has no usable answer, which disables Weiter. */
	canAdvance: boolean;
	onNext: () => void;
	children: React.ReactNode;
}

export const QuestionTip: React.FC<{ id: string; tip: string }> = ({
	id,
	tip,
}) => (
	<div
		id={`${id}-tip`}
		data-testid="question-tip"
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
);

export const QuestionShell: React.FC<QuestionShellProps> = ({
	id,
	category,
	tip,
	canAdvance,
	onNext,
	children,
}) => {
	const { t } = useTranslation();

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (canAdvance) {
			onNext();
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			data-testid="question-card"
			className="w-full font-sans flex flex-col justify-between flex-grow min-h-[360px]"
		>
			<div className="flex flex-col gap-6 w-full mb-8">
				<div className="flex flex-col gap-3">
					<p className="text-body text-brand-grey">
						{t(i18nKeys.eligibility.title)}
					</p>
					<h1 className="text-xl font-bold text-brand-black leading-snug">
						{category}
					</h1>
				</div>

				{tip && <QuestionTip id={id} tip={tip} />}

				{children}
			</div>

			<div className="w-full">
				<PrimaryButton
					type="submit"
					disabled={!canAdvance}
					data-testid="next-button"
				>
					{t(i18nKeys.common.next)}
				</PrimaryButton>
			</div>
		</form>
	);
};
