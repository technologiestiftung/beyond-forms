import React from "react";
import { useTranslation } from "react-i18next";
import { OptionCard } from "../../../components/ui/OptionCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

interface AwaitingBenefitsStepProps {
	hasAppliedForBenefitsAwaitingDecision: boolean | null;
	setHasAppliedForBenefitsAwaitingDecision: (val: boolean | null) => void;
	benefitsAwaitingDecisionType: string;
	setBenefitsAwaitingDecisionType: (val: string) => void;
	benefitsAwaitingDecisionApplicationDate: string;
	setBenefitsAwaitingDecisionApplicationDate: (val: string) => void;
	benefitsAwaitingDecisionOffice: string;
	setBenefitsAwaitingDecisionOffice: (val: string) => void;
	benefitsAwaitingDecisionReference: string;
	setBenefitsAwaitingDecisionReference: (val: string) => void;
	onContinue: () => void;
}

export const AwaitingBenefitsStep: React.FC<AwaitingBenefitsStepProps> = ({
	hasAppliedForBenefitsAwaitingDecision,
	setHasAppliedForBenefitsAwaitingDecision,
	benefitsAwaitingDecisionType,
	setBenefitsAwaitingDecisionType,
	benefitsAwaitingDecisionApplicationDate,
	setBenefitsAwaitingDecisionApplicationDate,
	benefitsAwaitingDecisionOffice,
	setBenefitsAwaitingDecisionOffice,
	benefitsAwaitingDecisionReference,
	setBenefitsAwaitingDecisionReference,
	onContinue,
}) => {
	const { t } = useTranslation("application");

	return (
		<div className="flex flex-col gap-5">
			<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
				{t("financial.questions.awaiting_benefits_title")}
			</h1>
			<div className="flex flex-col gap-3">
				<OptionCard
					id="ja"
					title={t("financial.options.yes")}
					selected={hasAppliedForBenefitsAwaitingDecision === true}
					onClick={() => setHasAppliedForBenefitsAwaitingDecision(true)}
				/>
				<OptionCard
					id="nein"
					title={t("financial.options.no")}
					selected={hasAppliedForBenefitsAwaitingDecision === false}
					onClick={() => setHasAppliedForBenefitsAwaitingDecision(false)}
				/>
			</div>

			{hasAppliedForBenefitsAwaitingDecision && (
				<div className="flex flex-col gap-4 mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-fadeIn">
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="awaiting-benefits-type"
							className="text-xs font-extrabold text-slate-800"
						>
							{t("financial.questions.awaiting_benefits_type_label")}
						</label>
						<select
							id="awaiting-benefits-type"
							value={benefitsAwaitingDecisionType}
							onChange={(e) => setBenefitsAwaitingDecisionType(e.target.value)}
							className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
						>
							<option value="">
								{t("financial.questions.awaiting_benefits_type_placeholder")}
							</option>
							<option value="Grundsicherung">
								{t("financial.options.benefit_options.grundsicherung")}
							</option>
							<option value="Hilfe zum Lebensunterhalt">
								{t("financial.options.benefit_options.hilfe_lebensunterhalt")}
							</option>
							<option value="Wohngeld">
								{t("financial.options.benefit_options.wohngeld")}
							</option>
							<option value="Krankengeld">
								{t("financial.options.benefit_options.krankengeld")}
							</option>
							<option value="Sonstiges">
								{t("financial.options.benefit_options.sonstiges")}
							</option>
						</select>
					</div>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="awaiting-benefits-date"
							className="text-xs font-extrabold text-slate-800"
						>
							{t("financial.questions.awaiting_benefits_date_label")}
						</label>
						<input
							id="awaiting-benefits-date"
							type="date"
							value={benefitsAwaitingDecisionApplicationDate}
							onChange={(e) =>
								setBenefitsAwaitingDecisionApplicationDate(e.target.value)
							}
							className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="awaiting-benefits-office"
							className="text-xs font-extrabold text-slate-800"
						>
							{t("financial.questions.awaiting_benefits_office_label")}
						</label>
						<input
							id="awaiting-benefits-office"
							type="text"
							value={benefitsAwaitingDecisionOffice}
							onChange={(e) =>
								setBenefitsAwaitingDecisionOffice(e.target.value)
							}
							placeholder={t(
								"financial.questions.awaiting_benefits_office_placeholder",
							)}
							className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="awaiting-benefits-ref"
							className="text-xs font-extrabold text-slate-800"
						>
							{t("financial.questions.awaiting_benefits_ref_label")}
						</label>
						<input
							id="awaiting-benefits-ref"
							type="text"
							value={benefitsAwaitingDecisionReference}
							onChange={(e) =>
								setBenefitsAwaitingDecisionReference(e.target.value)
							}
							placeholder={t(
								"financial.questions.awaiting_benefits_ref_placeholder",
							)}
							className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
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
