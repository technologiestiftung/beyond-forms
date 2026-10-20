import React from "react";
import { useTranslation } from "react-i18next";
import { OptionCard } from "../../../components/ui/OptionCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

interface PreviousBenefitsStepProps {
	hasReceivedPreviousBenefits: boolean | null;
	setHasReceivedPreviousBenefits: (val: boolean | null) => void;
	previousBenefitsPeriod: string;
	setPreviousBenefitsPeriod: (val: string) => void;
	previousBenefitsAuthority: string;
	setPreviousBenefitsAuthority: (val: string) => void;
	previousBenefitsRefNo: string;
	setPreviousBenefitsRefNo: (val: string) => void;
	onContinue: () => void;
}

export const PreviousBenefitsStep: React.FC<PreviousBenefitsStepProps> = ({
	hasReceivedPreviousBenefits,
	setHasReceivedPreviousBenefits,
	previousBenefitsPeriod,
	setPreviousBenefitsPeriod,
	previousBenefitsAuthority,
	setPreviousBenefitsAuthority,
	previousBenefitsRefNo,
	setPreviousBenefitsRefNo,
	onContinue,
}) => {
	const { t } = useTranslation("application");

	return (
		<div className="flex flex-col gap-5">
			<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
				{t("financial.questions.previous_benefits_title")}
			</h1>
			<div className="flex flex-col gap-3">
				<OptionCard
					id="ja"
					title={t("financial.options.yes")}
					selected={hasReceivedPreviousBenefits === true}
					onClick={() => setHasReceivedPreviousBenefits(true)}
				/>
				<OptionCard
					id="nein"
					title={t("financial.options.no")}
					selected={hasReceivedPreviousBenefits === false}
					onClick={() => setHasReceivedPreviousBenefits(false)}
				/>
			</div>

			{hasReceivedPreviousBenefits && (
				<div className="flex flex-col gap-4 mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-fadeIn">
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="prev-benefits-type"
							className="text-xs font-extrabold text-slate-800"
						>
							{t("financial.questions.previous_benefits_type_label")}
						</label>
						<input
							id="prev-benefits-type"
							type="text"
							value={previousBenefitsPeriod}
							onChange={(e) => setPreviousBenefitsPeriod(e.target.value)}
							placeholder={t(
								"financial.questions.previous_benefits_type_placeholder",
							)}
							className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="prev-benefits-office"
							className="text-xs font-extrabold text-slate-800"
						>
							{t("financial.questions.previous_benefits_office_label")}
						</label>
						<input
							id="prev-benefits-office"
							type="text"
							value={previousBenefitsAuthority}
							onChange={(e) => setPreviousBenefitsAuthority(e.target.value)}
							placeholder={t(
								"financial.questions.previous_benefits_office_placeholder",
							)}
							className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="prev-benefits-ref"
							className="text-xs font-extrabold text-slate-800"
						>
							{t("financial.questions.previous_benefits_ref_label")}
						</label>
						<input
							id="prev-benefits-ref"
							type="text"
							value={previousBenefitsRefNo}
							onChange={(e) => setPreviousBenefitsRefNo(e.target.value)}
							placeholder={t(
								"financial.questions.previous_benefits_ref_placeholder",
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
