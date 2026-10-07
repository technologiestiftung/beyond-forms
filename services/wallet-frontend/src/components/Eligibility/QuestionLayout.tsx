import React from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { i18nKeys } from "../../i18n/i18nKeys";
import { PrimaryButton } from "../ui/PrimaryButton";
import { questionTipId } from "./questionTipId";

interface QuestionLayoutProps {
	id: string;
	category: string;
	tip?: string;
	canSubmit: boolean;
	onSubmit: () => void;
	children: React.ReactNode;
}

export const QuestionLayout: React.FC<QuestionLayoutProps> = ({
	id,
	category,
	tip,
	canSubmit,
	onSubmit,
	children,
}) => {
	const { t } = useTranslation();
	const tipId = questionTipId(id);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (canSubmit) {
			onSubmit();
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			data-testid="question-card"
			className="w-full font-sans flex flex-col justify-between flex-grow min-h-90 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-5 lg:min-h-0 lg:grow-0"
		>
			<div className="flex flex-col gap-3 mb-6 lg:mb-0 lg:gap-2 lg:col-start-1 lg:row-start-1">
				<p className="text-body text-brand-grey">
					{t(i18nKeys.eligibility.title)}
				</p>
				<h1 className="text-xl font-bold text-brand-black leading-snug lg:text-h1">
					{category}
				</h1>
			</div>

			{tip && (
				<div
					id={tipId}
					className="bg-brand-bg border border-brand-border/40 rounded-xl p-4 flex flex-row gap-2 items-start mb-6 lg:mb-0 lg:col-start-2 lg:row-start-2"
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

			<div className="w-full flex flex-col justify-between grow gap-8 lg:col-start-1 lg:row-start-2 lg:bg-white lg:rounded-2xl lg:border lg:border-brand-border-subtle lg:shadow-cards lg:px-10 lg:py-8 lg:gap-0">
				{children}

				<div className="w-full lg:flex lg:justify-end lg:mt-6 lg:pt-5 lg:border-t lg:border-brand-border-subtle">
					<PrimaryButton
						type="submit"
						disabled={!canSubmit}
						data-testid="next-button"
						className="lg:w-auto lg:min-w-44"
					>
						{t(i18nKeys.common.next)}
					</PrimaryButton>
				</div>
			</div>
		</form>
	);
};
