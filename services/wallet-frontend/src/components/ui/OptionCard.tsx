import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

interface OptionCardProps {
	id: string;
	title: string;
	hinweis?: string;
	selected: boolean;
	onClick: () => void;
	type?: "radio" | "checkbox";
	dataTestId?: string;
}

export const OptionCard: React.FC<OptionCardProps> = ({
	id,
	title,
	hinweis,
	selected,
	onClick,
	type = "radio",
	dataTestId,
}) => {
	const { t } = useTranslation("common");
	const indicatorShape = type === "checkbox" ? "rounded-lg" : "rounded-full";
	const testId = dataTestId || `option-card-${id}`;

	let indicatorStateClasses = "border-slate-300 bg-white";
	if (selected) {
		if (type === "checkbox") {
			indicatorStateClasses =
				"border-primary-blue-500 bg-primary-blue-500 text-white";
		} else {
			indicatorStateClasses = "border-primary-blue-500 bg-white";
		}
	}

	return (
		<button
			type="button"
			onClick={onClick}
			data-testid={testId}
			className={`w-full p-5 rounded-3xl border text-left flex gap-4 transition-all active:scale-[0.98] ${
				selected
					? "bg-primary-blue-20/20 border-primary-blue-500 shadow-sm"
					: "bg-white border-slate-200 hover:border-slate-300"
			}`}
		>
			<div className="pt-1 shrink-0">
				<div
					className={`w-6 h-6 border flex items-center justify-center transition-all ${indicatorShape} ${indicatorStateClasses}`}
				>
					{selected &&
						(type === "checkbox" ? (
							<Check className="size-4 stroke-[3] text-white" />
						) : (
							<div className="w-3 h-3 bg-primary-blue-500 rounded-full animate-scaleUp" />
						))}
				</div>
			</div>
			<div className="flex flex-col gap-1.5">
				<span className="text-base font-bold text-slate-800 leading-snug">
					{title}
				</span>
				{hinweis ? (
					<span className="text-xs font-medium text-slate-500 leading-relaxed">
						<strong className="text-slate-600">{t("note")}: </strong>
						{hinweis}
					</span>
				) : null}
			</div>
		</button>
	);
};
