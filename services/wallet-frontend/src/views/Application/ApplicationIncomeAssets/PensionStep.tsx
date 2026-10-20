import React from "react";
import { useTranslation } from "react-i18next";
import { toggleOption } from "./incomeAssetsHelpers";
import { OptionCard } from "../../../components/ui/OptionCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

interface PensionStepProps {
	pensionTypes: string[];
	setPensionTypes: (val: string[]) => void;
	pensionAmount: string;
	setPensionAmount: (val: string) => void;
	onContinue: () => void;
}

export const PensionStep: React.FC<PensionStepProps> = ({
	pensionTypes,
	setPensionTypes,
	pensionAmount,
	setPensionAmount,
	onContinue,
}) => {
	const { t } = useTranslation("application");

	return (
		<div className="flex flex-col gap-5">
			<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
				{t("financial.questions.pension_title")}
			</h1>
			<div className="flex flex-col gap-3">
				<OptionCard
					id="altersrente"
					title={t("financial.options.pension_retirement")}
					type="checkbox"
					selected={pensionTypes.includes("Retirement")}
					onClick={() =>
						setPensionTypes(toggleOption(pensionTypes, "Retirement"))
					}
				/>
				<OptionCard
					id="erwerbsminderungsrente"
					title={t("financial.options.pension_reduced")}
					type="checkbox"
					selected={pensionTypes.includes("Reduced")}
					onClick={() => setPensionTypes(toggleOption(pensionTypes, "Reduced"))}
				/>
				<OptionCard
					id="witwenrente"
					title={t("financial.options.pension_survivor")}
					type="checkbox"
					selected={pensionTypes.includes("Survivor")}
					onClick={() =>
						setPensionTypes(toggleOption(pensionTypes, "Survivor"))
					}
				/>
				<OptionCard
					id="none"
					title={t("financial.options.none_of_these")}
					type="checkbox"
					selected={pensionTypes.includes("none")}
					onClick={() => setPensionTypes(toggleOption(pensionTypes, "none"))}
				/>
			</div>

			{!pensionTypes.includes("none") && pensionTypes.length > 0 && (
				<div className="flex flex-col gap-4 mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-fadeIn">
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="pension-amount"
							className="text-xs font-extrabold text-slate-800"
						>
							{t("financial.questions.pension_amount_label")}
						</label>
						<div className="relative">
							<input
								id="pension-amount"
								type="text"
								value={pensionAmount}
								onChange={(e) => {
									const val = e.target.value.replace(/[^0-9,.]/g, "");
									setPensionAmount(val);
								}}
								placeholder={t(
									"financial.questions.pension_amount_placeholder",
								)}
								className="w-full p-3.5 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none text-right"
							/>
							<span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">
								€
							</span>
						</div>
						<p className="text-[11px] font-semibold text-slate-500 mt-1">
							{t("financial.questions.amount_net_hint")}
						</p>
					</div>
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
