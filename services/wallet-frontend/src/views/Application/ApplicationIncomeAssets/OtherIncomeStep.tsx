import React from "react";
import { useTranslation } from "react-i18next";
import { toggleOption } from "./incomeAssetsHelpers";
import { OptionCard } from "../../../components/ui/OptionCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

interface OtherIncomeStepProps {
	otherIncomeTypes: string[];
	setOtherIncomeTypes: (val: string[]) => void;
	otherIncomeAmount: string;
	setOtherIncomeAmount: (val: string) => void;
	onContinue: () => void;
}

export const OtherIncomeStep: React.FC<OtherIncomeStepProps> = ({
	otherIncomeTypes,
	setOtherIncomeTypes,
	otherIncomeAmount,
	setOtherIncomeAmount,
	onContinue,
}) => {
	const { t } = useTranslation("application");

	return (
		<div className="flex flex-col gap-5">
			<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
				{t("financial.questions.other_income_title")}
			</h1>
			<div className="flex flex-col gap-3">
				<OptionCard
					id="krankengeld"
					title={t("financial.options.other_sick")}
					type="checkbox"
					selected={otherIncomeTypes.includes("Krankengeld")}
					onClick={() =>
						setOtherIncomeTypes(toggleOption(otherIncomeTypes, "Krankengeld"))
					}
				/>
				<OptionCard
					id="unterhalt"
					title={t("financial.options.other_alimony")}
					type="checkbox"
					selected={otherIncomeTypes.includes("Unterhalt")}
					onClick={() =>
						setOtherIncomeTypes(toggleOption(otherIncomeTypes, "Unterhalt"))
					}
				/>
				<OptionCard
					id="sonstige_einnahmen"
					title={t("financial.options.other_rent")}
					type="checkbox"
					selected={otherIncomeTypes.includes("Sonstige")}
					onClick={() =>
						setOtherIncomeTypes(toggleOption(otherIncomeTypes, "Sonstige"))
					}
				/>
				<OptionCard
					id="keine_einnahmen"
					title={t("financial.options.other_none")}
					type="checkbox"
					selected={otherIncomeTypes.includes("none")}
					onClick={() =>
						setOtherIncomeTypes(toggleOption(otherIncomeTypes, "none"))
					}
				/>
			</div>

			{otherIncomeTypes.length > 0 && !otherIncomeTypes.includes("none") && (
				<div className="flex flex-col gap-1.5 mt-2 animate-fadeIn">
					<label
						htmlFor="other-income-amount-input"
						className="text-xs font-extrabold text-slate-800"
					>
						{t("financial.questions.other_income_amount_label")}
					</label>
					<div className="relative">
						<span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand-grey">
							€
						</span>
						<input
							id="other-income-amount-input"
							type="text"
							value={otherIncomeAmount}
							onChange={(e) => setOtherIncomeAmount(e.target.value)}
							placeholder={t(
								"financial.questions.other_income_amount_placeholder",
							)}
							className="w-full pl-8 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
						/>
					</div>
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
