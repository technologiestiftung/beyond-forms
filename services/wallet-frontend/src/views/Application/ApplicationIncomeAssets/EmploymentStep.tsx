import React from "react";
import { useTranslation } from "react-i18next";
import { OptionCard } from "../../../components/ui/OptionCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

interface EmploymentStepProps {
	employmentStatus: string;
	setEmploymentStatus: (val: string) => void;
	jobTitle: string;
	setJobTitle: (val: string) => void;
	employerName: string;
	setEmployerName: (val: string) => void;
	incomeAmount: string;
	setIncomeAmount: (val: string) => void;
	onContinue: () => void;
}

export const EmploymentStep: React.FC<EmploymentStepProps> = ({
	employmentStatus,
	setEmploymentStatus,
	jobTitle,
	setJobTitle,
	employerName,
	setEmployerName,
	incomeAmount,
	setIncomeAmount,
	onContinue,
}) => {
	const { t } = useTranslation("application");

	return (
		<div className="flex flex-col gap-5">
			<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2rem] lg:leading-10">
				{t("financial.questions.employment_title")}
			</h1>
			<div className="flex flex-col gap-3">
				<OptionCard
					id="angestellt"
					title={t("financial.options.emp_employed")}
					selected={employmentStatus === "Angestellt"}
					onClick={() => setEmploymentStatus("Angestellt")}
				/>
				<OptionCard
					id="selbststaendig"
					title={t("financial.options.emp_self")}
					selected={employmentStatus === "Selbststaendig"}
					onClick={() => setEmploymentStatus("Selbststaendig")}
				/>
				<OptionCard
					id="ausbildung"
					title={t("financial.options.emp_student")}
					selected={employmentStatus === "Ausbildung"}
					onClick={() => setEmploymentStatus("Ausbildung")}
				/>
				<OptionCard
					id="arbeitslos"
					title={t("financial.options.emp_unemployed")}
					selected={employmentStatus === "Arbeitslos"}
					onClick={() => setEmploymentStatus("Arbeitslos")}
				/>
				<OptionCard
					id="nichts_davon"
					title={t("financial.options.emp_none")}
					selected={employmentStatus === "Nichts davon"}
					onClick={() => setEmploymentStatus("Nichts davon")}
				/>
			</div>

			{employmentStatus !== "" &&
				employmentStatus !== "Arbeitslos" &&
				employmentStatus !== "Nichts davon" && (
					<div className="flex flex-col gap-4 mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-fadeIn">
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="employer"
								className="text-xs font-extrabold text-slate-800"
							>
								{t("financial.questions.employer_label")}
							</label>
							<input
								id="employer"
								type="text"
								value={employerName}
								onChange={(e) => setEmployerName(e.target.value)}
								placeholder={t("financial.questions.employer_placeholder")}
								className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="jobTitle"
								className="text-xs font-extrabold text-slate-800"
							>
								{t("financial.questions.job_title_label")}
							</label>
							<input
								id="jobTitle"
								type="text"
								value={jobTitle}
								onChange={(e) => setJobTitle(e.target.value)}
								placeholder={t("financial.questions.job_title_placeholder")}
								className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="employment-amount-input"
								className="text-xs font-extrabold text-slate-800"
							>
								{t("financial.questions.employment_amount_label")}
							</label>
							<div className="relative">
								<span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand-grey">
									€
								</span>
								<input
									id="employment-amount-input"
									type="text"
									value={incomeAmount}
									onChange={(e) => {
										const val = e.target.value.replace(/[^0-9,.]/g, "");
										setIncomeAmount(val);
									}}
									placeholder={t(
										"financial.questions.employment_amount_placeholder",
									)}
									className="w-full pl-8 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
								/>
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
				disabled={!employmentStatus}
			>
				{t("financial.intro.continue")}
			</PrimaryButton>
		</div>
	);
};
