import React from "react";
import { useTranslation } from "react-i18next";
import { toggleOption, type IncomeAmounts } from "./incomeAssetsHelpers";
import { IncomeAmountField } from "./IncomeAmountField";
import { OptionCard } from "../../../components/ui/OptionCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

const OTHER_INCOME_OPTIONS = [
	{ value: "sick_pay", cardId: "sick_pay", label: "other_sick" },
	{ value: "alimony", cardId: "alimony", label: "other_alimony" },
	{ value: "other", cardId: "other_income", label: "other_rent" },
];

interface OtherIncomeStepProps {
	otherIncomeTypes: string[];
	setOtherIncomeTypes: (val: string[]) => void;
	otherIncomeAmounts: IncomeAmounts;
	setOtherIncomeAmount: (incomeType: string, amount: string) => void;
	onContinue: () => void;
}

export const OtherIncomeStep: React.FC<OtherIncomeStepProps> = ({
	otherIncomeTypes,
	setOtherIncomeTypes,
	otherIncomeAmounts,
	setOtherIncomeAmount,
	onContinue,
}) => {
	const { t } = useTranslation("application");
	const chosen = OTHER_INCOME_OPTIONS.filter((o) =>
		otherIncomeTypes.includes(o.value),
	);

	return (
		<div className="flex flex-col gap-5">
			<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
				{t("financial.questions.other_income_title")}
			</h1>
			<div className="flex flex-col gap-3">
				{OTHER_INCOME_OPTIONS.map((option) => (
					<OptionCard
						key={option.value}
						id={option.cardId}
						title={t(`financial.options.${option.label}`)}
						type="checkbox"
						selected={otherIncomeTypes.includes(option.value)}
						onClick={() =>
							setOtherIncomeTypes(toggleOption(otherIncomeTypes, option.value))
						}
					/>
				))}
				<OptionCard
					id="no_other_income"
					title={t("financial.options.other_none")}
					type="checkbox"
					selected={otherIncomeTypes.includes("none")}
					onClick={() =>
						setOtherIncomeTypes(toggleOption(otherIncomeTypes, "none"))
					}
				/>
			</div>

			{chosen.length > 0 && (
				<div className="flex flex-col gap-4 mt-2">
					{chosen.map((option) => (
						<IncomeAmountField
							key={option.value}
							id={`other-income-amount-${option.value}`}
							label={t(`financial.options.${option.label}`)}
							value={otherIncomeAmounts[option.value] ?? ""}
							onChange={(amount) => setOtherIncomeAmount(option.value, amount)}
							placeholder={t(
								"financial.questions.other_income_amount_placeholder",
							)}
						/>
					))}
				</div>
			)}
			<PrimaryButton
				className="lg:flex lg:w-fit lg:min-w-44 lg:ml-auto"
				onClick={onContinue}
			>
				{t("financial.intro.continue")}
			</PrimaryButton>
		</div>
	);
};
