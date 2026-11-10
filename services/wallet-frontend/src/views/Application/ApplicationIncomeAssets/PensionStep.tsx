import React from "react";
import { useTranslation } from "react-i18next";
import { toggleOption, type IncomeAmounts } from "./incomeAssetsHelpers";
import { IncomeAmountField } from "./IncomeAmountField";
import { OptionCard } from "../../../components/ui/OptionCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

const PENSION_OPTIONS = [
	{ value: "retirement", cardId: "retirement", label: "pension_retirement" },
	{
		value: "reduced",
		cardId: "reduced_earning_capacity",
		label: "pension_reduced",
	},
	{ value: "survivor", cardId: "survivor", label: "pension_survivor" },
];

interface PensionStepProps {
	pensionTypes: string[];
	setPensionTypes: (val: string[]) => void;
	pensionAmounts: IncomeAmounts;
	setPensionAmount: (pensionType: string, amount: string) => void;
	onContinue: () => void;
}

export const PensionStep: React.FC<PensionStepProps> = ({
	pensionTypes,
	setPensionTypes,
	pensionAmounts,
	setPensionAmount,
	onContinue,
}) => {
	const { t } = useTranslation("application");
	const chosen = PENSION_OPTIONS.filter((o) => pensionTypes.includes(o.value));

	return (
		<div className="flex flex-col gap-5">
			<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
				{t("financial.questions.pension_title")}
			</h1>
			<div className="flex flex-col gap-3">
				{PENSION_OPTIONS.map((option) => (
					<OptionCard
						key={option.value}
						id={option.cardId}
						title={t(`financial.options.${option.label}`)}
						type="checkbox"
						selected={pensionTypes.includes(option.value)}
						onClick={() =>
							setPensionTypes(toggleOption(pensionTypes, option.value))
						}
					/>
				))}
				<OptionCard
					id="no_pension"
					title={t("financial.options.none_of_these")}
					type="checkbox"
					selected={pensionTypes.includes("none")}
					onClick={() => setPensionTypes(toggleOption(pensionTypes, "none"))}
				/>
			</div>

			{chosen.length > 0 && (
				<div className="flex flex-col gap-4 mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-fadeIn">
					{chosen.map((option) => (
						<IncomeAmountField
							key={option.value}
							id={`pension-amount-${option.value}`}
							label={t(`financial.options.${option.label}`)}
							value={pensionAmounts[option.value] ?? ""}
							onChange={(amount) => setPensionAmount(option.value, amount)}
							placeholder={t("financial.questions.pension_amount_placeholder")}
						/>
					))}
				</div>
			)}
			<PrimaryButton
				className="lg:flex lg:w-fit lg:min-w-44 lg:ml-auto"
				onClick={onContinue}
				disabled={pensionTypes.length === 0}
			>
				{t("financial.intro.continue")}
			</PrimaryButton>
		</div>
	);
};
