/* eslint-disable complexity */
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useProfile } from "../../hooks/useProfile";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { AppRoutes } from "../../constants/routes";
import type { FinancialData, PersonalData } from "../../schemas/profile.schema";
import { PageContainer } from "../../components/Layout/PageContainer";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { useScrollToTop, scrollToTop } from "../../utils/scroll";
import { OptionCard } from "../../components/ui/OptionCard";

interface Page1AwaitingBenefitsProps {
	t: (key: string, options?: Record<string, unknown>) => string;
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
	savePage1: () => void;
}

const Page1AwaitingBenefits: React.FC<Page1AwaitingBenefitsProps> = ({
	t,
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
	savePage1,
}) => (
	<div className="flex flex-col gap-5">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
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
						onChange={(e) => setBenefitsAwaitingDecisionOffice(e.target.value)}
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
		<PrimaryButton onClick={savePage1}>
			{t("financial.intro.continue")}
		</PrimaryButton>
	</div>
);

interface Page2PreviousBenefitsProps {
	t: (key: string, options?: Record<string, unknown>) => string;
	hasReceivedPreviousBenefits: boolean | null;
	setHasReceivedPreviousBenefits: (val: boolean | null) => void;
	previousBenefitsPeriod: string;
	setPreviousBenefitsPeriod: (val: string) => void;
	previousBenefitsAuthority: string;
	setPreviousBenefitsAuthority: (val: string) => void;
	previousBenefitsRefNo: string;
	setPreviousBenefitsRefNo: (val: string) => void;
	savePage2: () => void;
}

const Page2PreviousBenefits: React.FC<Page2PreviousBenefitsProps> = ({
	t,
	hasReceivedPreviousBenefits,
	setHasReceivedPreviousBenefits,
	previousBenefitsPeriod,
	setPreviousBenefitsPeriod,
	previousBenefitsAuthority,
	setPreviousBenefitsAuthority,
	previousBenefitsRefNo,
	setPreviousBenefitsRefNo,
	savePage2,
}) => (
	<div className="flex flex-col gap-5">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
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
		<PrimaryButton onClick={savePage2}>
			{t("financial.intro.continue")}
		</PrimaryButton>
	</div>
);

interface Page3PensionProps {
	t: (key: string, options?: Record<string, unknown>) => string;
	pensionTypes: string[];
	setPensionTypes: (val: string[]) => void;
	handleCheckboxChange: (
		list: string[],
		setList: (val: string[]) => void,
		val: string,
	) => void;
	pensionAmount: string;
	setPensionAmount: (val: string) => void;
	savePage3: () => void;
}

const Page3Pension: React.FC<Page3PensionProps> = ({
	t,
	pensionTypes,
	setPensionTypes,
	handleCheckboxChange,
	pensionAmount,
	setPensionAmount,
	savePage3,
}) => (
	<div className="flex flex-col gap-5">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
			{t("financial.questions.pension_title")}
		</h1>
		<div className="flex flex-col gap-3">
			<OptionCard
				id="altersrente"
				title={t("financial.options.pension_retirement")}
				type="checkbox"
				selected={pensionTypes.includes("Retirement")}
				onClick={() =>
					handleCheckboxChange(pensionTypes, setPensionTypes, "Retirement")
				}
			/>
			<OptionCard
				id="erwerbsminderungsrente"
				title={t("financial.options.pension_reduced")}
				type="checkbox"
				selected={pensionTypes.includes("Reduced")}
				onClick={() =>
					handleCheckboxChange(pensionTypes, setPensionTypes, "Reduced")
				}
			/>
			<OptionCard
				id="witwenrente"
				title={t("financial.options.pension_survivor")}
				type="checkbox"
				selected={pensionTypes.includes("Survivor")}
				onClick={() =>
					handleCheckboxChange(pensionTypes, setPensionTypes, "Survivor")
				}
			/>
			<OptionCard
				id="none"
				title={t("financial.options.none_of_these")}
				type="checkbox"
				selected={pensionTypes.includes("none")}
				onClick={() =>
					handleCheckboxChange(pensionTypes, setPensionTypes, "none")
				}
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
							placeholder={t("financial.questions.pension_amount_placeholder")}
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
		<PrimaryButton onClick={savePage3} disabled={pensionTypes.length === 0}>
			{t("financial.intro.continue")}
		</PrimaryButton>
	</div>
);

interface Page4EmploymentProps {
	t: (key: string) => string;
	employmentStatus: string;
	setEmploymentStatus: (val: string) => void;
	jobTitle: string;
	setJobTitle: (val: string) => void;
	employerName: string;
	setEmployerName: (val: string) => void;
	incomeAmount: string;
	setIncomeAmount: (val: string) => void;
	savePage4: () => void;
}

const Page4Employment: React.FC<Page4EmploymentProps> = ({
	t,
	employmentStatus,
	setEmploymentStatus,
	jobTitle,
	setJobTitle,
	employerName,
	setEmployerName,
	incomeAmount,
	setIncomeAmount,
	savePage4,
}) => (
	<div className="flex flex-col gap-5">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
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
		<PrimaryButton onClick={savePage4} disabled={!employmentStatus}>
			{t("financial.intro.continue")}
		</PrimaryButton>
	</div>
);

interface Page5OtherIncomeProps {
	t: (key: string) => string;
	otherIncomeTypes: string[];
	setOtherIncomeTypes: (val: string[]) => void;
	handleCheckboxChange: (
		list: string[],
		setList: (val: string[]) => void,
		val: string,
	) => void;
	otherIncomeAmount: string;
	setOtherIncomeAmount: (val: string) => void;
	savePage5: () => void;
}

const Page5OtherIncome: React.FC<Page5OtherIncomeProps> = ({
	t,
	otherIncomeTypes,
	setOtherIncomeTypes,
	handleCheckboxChange,
	otherIncomeAmount,
	setOtherIncomeAmount,
	savePage5,
}) => (
	<div className="flex flex-col gap-5">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
			{t("financial.questions.other_income_title")}
		</h1>
		<div className="flex flex-col gap-3">
			<OptionCard
				id="krankengeld"
				title={t("financial.options.other_sick")}
				type="checkbox"
				selected={otherIncomeTypes.includes("Krankengeld")}
				onClick={() =>
					handleCheckboxChange(
						otherIncomeTypes,
						setOtherIncomeTypes,
						"Krankengeld",
					)
				}
			/>
			<OptionCard
				id="unterhalt"
				title={t("financial.options.other_alimony")}
				type="checkbox"
				selected={otherIncomeTypes.includes("Unterhalt")}
				onClick={() =>
					handleCheckboxChange(
						otherIncomeTypes,
						setOtherIncomeTypes,
						"Unterhalt",
					)
				}
			/>
			<OptionCard
				id="sonstige_einnahmen"
				title={t("financial.options.other_rent")}
				type="checkbox"
				selected={otherIncomeTypes.includes("Sonstige")}
				onClick={() =>
					handleCheckboxChange(
						otherIncomeTypes,
						setOtherIncomeTypes,
						"Sonstige",
					)
				}
			/>
			<OptionCard
				id="keine_einnahmen"
				title={t("financial.options.other_none")}
				type="checkbox"
				selected={otherIncomeTypes.includes("none")}
				onClick={() =>
					handleCheckboxChange(otherIncomeTypes, setOtherIncomeTypes, "none")
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
		<PrimaryButton onClick={savePage5}>
			{t("financial.intro.continue")}
		</PrimaryButton>
	</div>
);

interface Page6OneTimeProps {
	t: (key: string) => string;
	areOneTimePaymentsExpected: boolean | null;
	setAreOneTimePaymentsExpected: (val: boolean | null) => void;
	oneTimePaymentsExpectedType: string;
	setOneTimePaymentsExpectedType: (val: string) => void;
	oneTimePaymentsExpectedAmount: string;
	setOneTimePaymentsExpectedAmount: (val: string) => void;
	oneTimePaymentsExpectedDate: string;
	setOneTimePaymentsExpectedDate: (val: string) => void;
	savePage6: () => void;
}

const Page6OneTime: React.FC<Page6OneTimeProps> = ({
	t,
	areOneTimePaymentsExpected,
	setAreOneTimePaymentsExpected,
	oneTimePaymentsExpectedType,
	setOneTimePaymentsExpectedType,
	oneTimePaymentsExpectedAmount,
	setOneTimePaymentsExpectedAmount,
	oneTimePaymentsExpectedDate,
	setOneTimePaymentsExpectedDate,
	savePage6,
}) => (
	<div className="flex flex-col gap-5">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
			{t("financial.questions.one_time_payment_title")}
		</h1>
		<div className="flex flex-col gap-3">
			<OptionCard
				id="ja"
				title={t("financial.options.yes")}
				selected={areOneTimePaymentsExpected === true}
				onClick={() => setAreOneTimePaymentsExpected(true)}
			/>
			<OptionCard
				id="nein"
				title={t("financial.options.no")}
				selected={areOneTimePaymentsExpected === false}
				onClick={() => setAreOneTimePaymentsExpected(false)}
			/>
		</div>

		{areOneTimePaymentsExpected && (
			<div className="flex flex-col gap-4 mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-fadeIn">
				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="one-time-payment-type"
						className="text-xs font-extrabold text-slate-800"
					>
						{t("financial.questions.one_time_payment_type_label")}
					</label>
					<input
						id="one-time-payment-type"
						type="text"
						value={oneTimePaymentsExpectedType}
						onChange={(e) => setOneTimePaymentsExpectedType(e.target.value)}
						placeholder={t(
							"financial.questions.one_time_payment_type_placeholder",
						)}
						className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="one-time-payment-amount"
						className="text-xs font-extrabold text-slate-800"
					>
						{t("financial.questions.one_time_payment_amount_label")}
					</label>
					<div className="relative">
						<span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand-grey">
							€
						</span>
						<input
							id="one-time-payment-amount"
							type="text"
							value={oneTimePaymentsExpectedAmount}
							onChange={(e) => setOneTimePaymentsExpectedAmount(e.target.value)}
							placeholder={t(
								"financial.questions.one_time_payment_amount_placeholder",
							)}
							className="w-full pl-8 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
						/>
					</div>
				</div>
				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="one-time-payment-date"
						className="text-xs font-extrabold text-slate-800"
					>
						{t("financial.questions.one_time_payment_date_label")}
					</label>
					<input
						id="one-time-payment-date"
						type="date"
						value={oneTimePaymentsExpectedDate}
						onChange={(e) => setOneTimePaymentsExpectedDate(e.target.value)}
						className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
					/>
				</div>
			</div>
		)}
		<PrimaryButton onClick={savePage6}>
			{t("financial.intro.continue")}
		</PrimaryButton>
	</div>
);

interface Page7BankProps {
	t: (key: string) => string;
	bankName: string;
	setBankName: (val: string) => void;
	accountHolder: string;
	setAccountHolder: (val: string) => void;
	iban: string;
	setIban: (val: string) => void;
	bic: string;
	setBic: (val: string) => void;
	fieldErrors: Record<string, string>;
	setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
	savePage7: () => void;
}

const Page7Bank: React.FC<Page7BankProps> = ({
	t,
	bankName,
	setBankName,
	accountHolder,
	setAccountHolder,
	iban,
	setIban,
	bic,
	setBic,
	fieldErrors,
	setFieldErrors,
	savePage7,
}) => (
	<div className="flex flex-col gap-5">
		<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
			{t("financial.questions.bank_title")}
		</h1>

		<div className="flex flex-col gap-4 mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="account-holder"
					className="text-xs font-extrabold text-slate-800"
				>
					{t("financial.questions.account_holder_label")}
				</label>
				<input
					id="account-holder"
					type="text"
					value={accountHolder}
					onChange={(e) => setAccountHolder(e.target.value)}
					placeholder={t("financial.questions.account_holder_placeholder")}
					className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="bank-name"
					className="text-xs font-extrabold text-slate-800"
				>
					{t("financial.questions.bank_name_label")}
				</label>
				<input
					id="bank-name"
					type="text"
					value={bankName}
					onChange={(e) => setBankName(e.target.value)}
					placeholder={t("financial.questions.bank_name_placeholder")}
					className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label htmlFor="iban" className="text-xs font-extrabold text-slate-800">
					{t("financial.questions.iban_label")}
				</label>
				<input
					id="iban"
					type="text"
					value={iban}
					onChange={(e) => {
						setIban(e.target.value.toUpperCase());
						if (fieldErrors.iban) {
							setFieldErrors((prev) => {
								const copy = { ...prev };
								delete copy.iban;
								return copy;
							});
						}
					}}
					placeholder={t("financial.questions.iban_placeholder")}
					className={`p-3.5 bg-white border rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none ${fieldErrors.iban ? "border-rose-500" : "border-slate-200"}`}
				/>
				{fieldErrors.iban && (
					<span className="text-xs text-rose-500 font-semibold px-1 mt-0.5">
						{fieldErrors.iban}
					</span>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				<label htmlFor="bic" className="text-xs font-extrabold text-slate-800">
					{t("financial.questions.bic_label")}
				</label>
				<input
					id="bic"
					type="text"
					value={bic}
					onChange={(e) => setBic(e.target.value.toUpperCase())}
					placeholder={t("financial.questions.bic_placeholder")}
					className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
				/>
			</div>
		</div>

		<PrimaryButton
			onClick={savePage7}
			disabled={!accountHolder || !bankName || !iban}
		>
			{t("financial.questions.submit_cta")}
		</PrimaryButton>
	</div>
);

export const ApplicationIncomeAssetsQuestions: React.FC = () => {
	const { t } = useTranslation(["application", "profile", "common"]);
	const navigate = useNavigate();
	const location = useLocation();
	const state = location.state as {
		extractedData?: Record<string, string | number | null>;
	} | null;
	const extracted = state?.extractedData;
	const { profileData, updateSection, isUpdating, refetch, isLoading } =
		useProfile();
	const isInitializedRef = useRef(false);

	const [currentPage, setCurrentPage] = useState<number>(1);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	// Q1: Awaiting benefits
	const [
		hasAppliedForBenefitsAwaitingDecision,
		setHasAppliedForBenefitsAwaitingDecision,
	] = useState<boolean | null>(null);
	const [benefitsAwaitingDecisionType, setBenefitsAwaitingDecisionType] =
		useState<string>("");
	const [
		benefitsAwaitingDecisionApplicationDate,
		setBenefitsAwaitingDecisionApplicationDate,
	] = useState<string>("");
	const [benefitsAwaitingDecisionOffice, setBenefitsAwaitingDecisionOffice] =
		useState<string>("");
	const [
		benefitsAwaitingDecisionReference,
		setBenefitsAwaitingDecisionReference,
	] = useState<string>("");

	// Q2: Previous benefits
	const [hasReceivedPreviousBenefits, setHasReceivedPreviousBenefits] =
		useState<boolean | null>(null);
	const [previousBenefitsPeriod, setPreviousBenefitsPeriod] =
		useState<string>("");
	const [previousBenefitsAuthority, setPreviousBenefitsAuthority] =
		useState<string>("");
	const [previousBenefitsRefNo, setPreviousBenefitsRefNo] =
		useState<string>("");

	// Q3: Pension
	const [selectedSources, setSelectedSources] = useState<string[]>([]);
	const [pensionTypes, setPensionTypes] = useState<string[]>([]);
	const [pensionAmount, setPensionAmount] = useState<string>("");

	// Q4: Employment
	const [employmentType, setEmploymentType] = useState<string>("");
	const [jobTitle, setJobTitle] = useState("");
	const [employerName, setEmployerName] = useState("");
	const [employmentAmount, setEmploymentAmount] = useState<string>("");

	// Q5: Other income
	const [otherIncomeTypes, setOtherIncomeTypes] = useState<string[]>([]);
	const [otherIncomeAmount, setOtherIncomeAmount] = useState<string>("");

	// Q6: One-time payments
	const [areOneTimePaymentsExpected, setAreOneTimePaymentsExpected] = useState<
		boolean | null
	>(null);
	const [oneTimePaymentsExpectedType, setOneTimePaymentsExpectedType] =
		useState<string>("");
	const [oneTimePaymentsExpectedAmount, setOneTimePaymentsExpectedAmount] =
		useState<string>("");
	const [oneTimePaymentsExpectedDate, setOneTimePaymentsExpectedDate] =
		useState<string>("");

	// Q7: Bank details
	const [bankName, setBankName] = useState("");
	const [accountHolder, setAccountHolder] = useState("");
	const [iban, setIban] = useState("");
	const [bic, setBic] = useState("");

	useScrollToTop(currentPage);

	const initPension = React.useCallback(
		(financial: Partial<FinancialData>, sources: string[]) => {
			const cachedPension = sessionStorage.getItem(
				"income_assets_pension_amount",
			);

			const types = sources
				.filter((s) => s.startsWith("pension_"))
				.map((s) => s.replace("pension_", ""));
			const capitalizedTypes = types.map(
				(typeStr) => typeStr.charAt(0).toUpperCase() + typeStr.slice(1),
			);
			if (
				sources.includes("Altersrente") &&
				!capitalizedTypes.includes("Retirement")
			) {
				capitalizedTypes.push("Retirement");
			}
			if (
				sources.includes("Erwerbsminderungsrente") &&
				!capitalizedTypes.includes("Reduced")
			) {
				capitalizedTypes.push("Reduced");
			}
			if (capitalizedTypes.length > 0) {
				setPensionTypes(capitalizedTypes);
			} else if (
				sources.includes("pension") ||
				(extracted &&
					(extracted.monthly_income ||
						extracted.monthly_amount ||
						extracted.amount_pension))
			) {
				setPensionTypes(["Retirement"]);
			} else if (sources.includes("none_pension")) {
				setPensionTypes(["none"]);
			}

			if (cachedPension !== null) {
				setPensionAmount(cachedPension);
			} else if (
				extracted &&
				(extracted.monthly_income ||
					extracted.monthly_amount ||
					extracted.amount_pension)
			) {
				setPensionAmount(
					String(
						extracted.monthly_income ||
							extracted.monthly_amount ||
							extracted.amount_pension ||
							"",
					),
				);
				if (!sources.includes("pension")) {
					sources.push("pension");
					setSelectedSources([...sources]);
				}
			} else if (
				sources.includes("pension") ||
				sources.includes("Altersrente") ||
				sources.includes("Erwerbsminderungsrente")
			) {
				setPensionAmount(String(financial.monthlyIncome || ""));
			}
		},
		[extracted],
	);

	const initEmployment = React.useCallback(
		(
			financial: Partial<FinancialData>,
			personal: Partial<PersonalData>,
			sources: string[],
		) => {
			const cachedEmployment = sessionStorage.getItem(
				"income_assets_employment_amount",
			);
			if (sources.includes("employment_employed")) {
				setEmploymentType("Angestellt");
			} else if (sources.includes("employment_self")) {
				setEmploymentType("Selbststaendig");
			} else if (sources.includes("employment_student")) {
				setEmploymentType("Ausbildung");
			} else if (sources.includes("employment_unemployed")) {
				setEmploymentType("Arbeitslos");
			} else if (sources.includes("employment_none")) {
				setEmploymentType("Nichts davon");
			} else if (personal.isCurrentlyEmployed === true) {
				setEmploymentType("Angestellt");
			} else if (personal.isCurrentlyEmployed === false) {
				setEmploymentType("Arbeitslos");
			}

			if (cachedEmployment !== null) {
				setEmploymentAmount(cachedEmployment);
			} else if (personal.isCurrentlyEmployed === true) {
				setEmploymentAmount(String(financial.monthlyIncome || ""));
			}
		},
		[],
	);

	const initOther = React.useCallback(
		(financial: Partial<FinancialData>, sources: string[]) => {
			const cachedOther = sessionStorage.getItem("income_assets_other_amount");
			const otherTypes: string[] = [];
			if (sources.includes("other_sick")) {
				otherTypes.push("Krankengeld");
			}
			if (sources.includes("other_alimony")) {
				otherTypes.push("Unterhalt");
			}
			if (sources.includes("other_rent")) {
				otherTypes.push("Sonstige");
			}

			if (otherTypes.length > 0) {
				setOtherIncomeTypes(otherTypes);
			} else if (
				sources.includes("other_benefits") ||
				sources.includes("other") ||
				sources.includes("Krankengeld") ||
				sources.includes("Arbeitslosengeld") ||
				sources.includes("Kindergeld")
			) {
				setOtherIncomeTypes(["Sonstige"]);
			} else if (sources.includes("none_other")) {
				setOtherIncomeTypes(["none"]);
			}

			if (cachedOther !== null) {
				setOtherIncomeAmount(cachedOther);
			} else if (otherTypes.length > 0) {
				setOtherIncomeAmount(String(financial.monthlyIncome || ""));
			}
		},
		[],
	);

	const initIncomeAssets = React.useCallback(() => {
		const financial: Partial<FinancialData> = profileData?.financial ?? {};
		const personal: Partial<PersonalData> = profileData?.personalData ?? {};
		const sources = financial.incomeSources || [];
		setSelectedSources(sources);

		const setAwaiting = () => {
			setHasAppliedForBenefitsAwaitingDecision(
				financial.hasAppliedForBenefitsAwaitingDecision ?? null,
			);
			setBenefitsAwaitingDecisionType(
				financial.benefitsAwaitingDecisionType || "",
			);
			setBenefitsAwaitingDecisionApplicationDate(
				financial.benefitsAwaitingDecisionApplicationDate || "",
			);
			setBenefitsAwaitingDecisionOffice(
				financial.benefitsAwaitingDecisionOffice || "",
			);
			setBenefitsAwaitingDecisionReference(
				financial.benefitsAwaitingDecisionReference || "",
			);
		};

		const setPrevious = () => {
			setHasReceivedPreviousBenefits(
				personal.hasReceivedPreviousBenefits ?? null,
			);
			setPreviousBenefitsPeriod(personal.previousBenefitsPeriod || "");
			setPreviousBenefitsAuthority(personal.previousBenefitsAuthority || "");
			setPreviousBenefitsRefNo(personal.previousBenefitsRefNo || "");
		};

		const setOneTime = () => {
			setAreOneTimePaymentsExpected(
				financial.areOneTimePaymentsExpected ?? null,
			);
			setOneTimePaymentsExpectedType(
				financial.oneTimePaymentsExpectedType || "",
			);
			setOneTimePaymentsExpectedAmount(
				financial.oneTimePaymentsExpectedAmount !== undefined &&
					financial.oneTimePaymentsExpectedAmount !== null
					? String(financial.oneTimePaymentsExpectedAmount)
					: "",
			);
			setOneTimePaymentsExpectedDate(
				financial.oneTimePaymentsExpectedDate || "",
			);
		};

		const setBank = () => {
			if (
				extracted &&
				(extracted.iban || extracted.account_holder || extracted.bank_name)
			) {
				setBankName(
					String(extracted.bank_name || financial.bankDetails?.bankName || ""),
				);
				setAccountHolder(
					String(
						extracted.account_holder ||
							financial.bankDetails?.accountHolder ||
							"",
					),
				);
				setIban(String(extracted.iban || financial.bankDetails?.iban || ""));
				setBic(String(extracted.bic || financial.bankDetails?.bic || ""));
			} else if (financial.bankDetails) {
				setBankName(financial.bankDetails.bankName || "");
				setAccountHolder(financial.bankDetails.accountHolder || "");
				setIban(financial.bankDetails.iban || "");
				setBic(financial.bankDetails.bic || "");
			} else {
				const banking =
					(profileData as unknown as { banking?: Record<string, string> })
						?.banking ?? {};
				setBankName(banking.bankName || "");
				setAccountHolder(banking.accountHolder || "");
				setIban(banking.iban || "");
				setBic(banking.bic || "");
			}
		};

		setAwaiting();
		setPrevious();
		initPension(financial, sources);
		initEmployment(financial, personal, sources);
		initOther(financial, sources);
		setOneTime();
		setBank();

		isInitializedRef.current = true;
	}, [profileData, initPension, initEmployment, initOther, extracted]);

	useEffect(() => {
		if (profileData && !isInitializedRef.current) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			initIncomeAssets();
		}
	}, [profileData, initIncomeAssets]);

	useEffect(() => {
		if (saveError || Object.keys(fieldErrors).length > 0) {
			scrollToTop("smooth");
		}
	}, [saveError, fieldErrors]);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	const handleValidationErrors = (
		errors?: Array<{ field_path: string; message: string }>,
	) => {
		if (!errors) {
			setFieldErrors({});
			return;
		}
		const errs: Record<string, string> = {};
		errors.forEach((err) => {
			errs[err.field_path] = err.message;
		});
		setFieldErrors(errs);
	};

	const clearErrors = () => {
		setSaveError(null);
		setFieldErrors({});
	};

	const getNextPage = (
		result: {
			data?: { wizard_evaluation?: { next_step?: string | null } | null };
		},
		fallbackPage: number,
	): number => {
		const nextStepId = result.data?.wizard_evaluation?.next_step;
		if (!nextStepId) {
			return fallbackPage;
		}
		if (nextStepId === "END") {
			return 8;
		} // Special value to indicate end of category

		const STEP_TO_PAGE_MAP: Record<string, number> = {
			step_applicant_benefits_awaiting_decision: 1,
			step_applicant_benefits_awaiting_decision_details: 1,
			step_previous_benefits: 2,
			step_previous_benefits_details: 2,
			step_applicant_pension: 3,
			step_applicant_employment: 4,
			step_applicant_employment_details: 4,
			step_applicant_work_capacity: 4,
			step_applicant_work_capacity_reason: 4,
			step_applicant_income_work: 5,
			step_applicant_income_benefits: 5,
			step_applicant_income_other: 5,
			step_applicant_expected_payments: 6,
			step_applicant_expected_payments_details: 6,
			step_applicant_bank_details: 7,
		};

		return STEP_TO_PAGE_MAP[nextStepId] ?? fallbackPage;
	};

	const savePage1 = async () => {
		clearErrors();
		try {
			const result = await updateSection({
				section: "financial",
				data: {
					hasAppliedForBenefitsAwaitingDecision,
					benefitsAwaitingDecisionType: hasAppliedForBenefitsAwaitingDecision
						? benefitsAwaitingDecisionType
						: null,
					benefitsAwaitingDecisionApplicationDate:
						hasAppliedForBenefitsAwaitingDecision &&
						benefitsAwaitingDecisionApplicationDate
							? benefitsAwaitingDecisionApplicationDate
							: null,
					benefitsAwaitingDecisionOffice: hasAppliedForBenefitsAwaitingDecision
						? benefitsAwaitingDecisionOffice
						: null,
					benefitsAwaitingDecisionReference:
						hasAppliedForBenefitsAwaitingDecision
							? benefitsAwaitingDecisionReference
							: null,
					validateEntireForm: false,
				},
			});
			if (result.success) {
				setSaveSuccess(true);
				setTimeout(() => setSaveSuccess(false), 800);
				const next = getNextPage(
					result as { data?: { wizard_evaluation?: { next_step?: string } } },
					2,
				);
				if (next === 8) {
					navigate(AppRoutes.ApplicationOverview);
				} else {
					setCurrentPage(next);
				}
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("profile:errors.save_failed"));
			}
		} catch (_error) {
			setSaveError(t("profile:errors.save_failed"));
		}
	};

	const savePage2 = async () => {
		clearErrors();
		try {
			const result = await updateSection({
				section: "personalData",
				data: {
					hasReceivedPreviousBenefits,
					previousBenefitsPeriod: hasReceivedPreviousBenefits
						? previousBenefitsPeriod
						: null,
					previousBenefitsAuthority: hasReceivedPreviousBenefits
						? previousBenefitsAuthority
						: null,
					previousBenefitsRefNo: hasReceivedPreviousBenefits
						? previousBenefitsRefNo
						: null,
					validateEntireForm: false,
				},
			});
			if (result.success) {
				setSaveSuccess(true);
				setTimeout(() => setSaveSuccess(false), 800);
				const next = getNextPage(
					result as { data?: { wizard_evaluation?: { next_step?: string } } },
					3,
				);
				if (next === 8) {
					navigate(AppRoutes.ApplicationOverview);
				} else {
					setCurrentPage(next);
				}
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("profile:errors.save_failed"));
			}
		} catch (_error) {
			setSaveError(t("profile:errors.save_failed"));
		}
	};

	const savePage3 = async () => {
		clearErrors();
		if (pensionAmount.trim() !== "") {
			const amt = Number(pensionAmount.replace(",", "."));
			if (isNaN(amt) || amt < 0) {
				setSaveError(
					t(
						"financial.errors.pension_amount_invalid",
						"Ungültiger Rentenbetrag",
					),
				);
				return;
			}
		}
		sessionStorage.setItem("income_assets_pension_amount", pensionAmount);

		// Format specific sub-type keys for backward compatibility
		const updatedSources = selectedSources.filter(
			(s) => !s.startsWith("pension") && s !== "none_pension",
		);
		if (pensionTypes.includes("none")) {
			updatedSources.push("none_pension");
		} else if (pensionTypes.length > 0) {
			updatedSources.push("pension");
			pensionTypes.forEach((typeStr) => {
				updatedSources.push(`pension_${typeStr.toLowerCase()}`);
			});
		}

		try {
			const result = await updateSection({
				section: "financial",
				data: {
					incomeSources: updatedSources,
					validateEntireForm: false,
				},
			});
			if (result.success) {
				setSelectedSources(updatedSources);
				setSaveSuccess(true);
				setTimeout(() => setSaveSuccess(false), 800);
				const next = getNextPage(
					result as { data?: { wizard_evaluation?: { next_step?: string } } },
					4,
				);
				if (next === 8) {
					navigate(AppRoutes.ApplicationOverview);
				} else {
					setCurrentPage(next);
				}
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("profile:errors.save_failed"));
			}
		} catch (_error) {
			setSaveError(t("profile:errors.save_failed"));
		}
	};

	const savePage4 = async () => {
		clearErrors();
		if (employmentAmount.trim() !== "") {
			const amt = Number(employmentAmount.replace(",", "."));
			if (isNaN(amt) || amt < 0) {
				setSaveError(
					t(
						"financial.errors.employment_amount_invalid",
						"Ungültiger Verdienstbetrag",
					),
				);
				return;
			}
		}
		let isEmp: boolean | null = null;
		if (employmentType) {
			if (
				employmentType === "Arbeitslos" ||
				employmentType === "Nichts davon"
			) {
				isEmp = false;
			} else {
				isEmp = true;
			}
		}

		sessionStorage.setItem("income_assets_employment_amount", employmentAmount);

		const updatedSources = selectedSources.filter(
			(s) => !s.startsWith("employment_"),
		);
		if (employmentType === "Angestellt") {
			updatedSources.push("employment_employed");
		} else if (employmentType === "Selbststaendig") {
			updatedSources.push("employment_self");
		} else if (employmentType === "Ausbildung") {
			updatedSources.push("employment_student");
		} else if (employmentType === "Arbeitslos") {
			updatedSources.push("employment_unemployed");
		} else if (employmentType === "Nichts davon") {
			updatedSources.push("employment_none");
		}

		try {
			const result = await updateSection({
				section: "personalData",
				data: {
					isCurrentlyEmployed: isEmp,
					validateEntireForm: false,
				},
			});
			const resultSources = await updateSection({
				section: "financial",
				data: {
					incomeSources: updatedSources,
					validateEntireForm: false,
				},
			});

			if (result.success && resultSources.success) {
				setSelectedSources(updatedSources);
				setSaveSuccess(true);
				setTimeout(() => setSaveSuccess(false), 800);
				const next = getNextPage(resultSources, 5);
				if (next === 8) {
					navigate(AppRoutes.ApplicationOverview);
				} else {
					setCurrentPage(next);
				}
			} else {
				setSaveError(t("profile:errors.save_failed"));
			}
		} catch (_error) {
			setSaveError(t("profile:errors.save_failed"));
		}
	};

	const savePage5 = async () => {
		clearErrors();
		if (otherIncomeAmount.trim() !== "") {
			const amt = Number(otherIncomeAmount.replace(",", "."));
			if (isNaN(amt) || amt < 0) {
				setSaveError(
					t(
						"financial.errors.other_income_amount_invalid",
						"Ungültiger Einnahmenbetrag",
					),
				);
				return;
			}
		}
		sessionStorage.setItem("income_assets_other_amount", otherIncomeAmount);

		const updatedSources = selectedSources.filter(
			(s) =>
				s !== "other_benefits" &&
				s !== "other" &&
				s !== "none_other" &&
				!s.startsWith("other_"),
		);

		if (otherIncomeTypes.includes("none")) {
			updatedSources.push("none_other");
		} else if (otherIncomeTypes.length > 0) {
			if (
				otherIncomeTypes.includes("Krankengeld") ||
				otherIncomeTypes.includes("Unterhalt")
			) {
				updatedSources.push("other_benefits");
			}
			if (otherIncomeTypes.includes("Sonstige")) {
				updatedSources.push("other");
			}
			otherIncomeTypes.forEach((typeStr) => {
				if (typeStr === "Krankengeld") {
					updatedSources.push("other_sick");
				}
				if (typeStr === "Unterhalt") {
					updatedSources.push("other_alimony");
				}
				if (typeStr === "Sonstige") {
					updatedSources.push("other_rent");
				}
			});
		}

		try {
			const result = await updateSection({
				section: "financial",
				data: {
					incomeSources: updatedSources,
					validateEntireForm: false,
				},
			});
			if (result.success) {
				setSelectedSources(updatedSources);
				setSaveSuccess(true);
				setTimeout(() => setSaveSuccess(false), 800);
				const next = getNextPage(
					result as { data?: { wizard_evaluation?: { next_step?: string } } },
					6,
				);
				if (next === 8) {
					navigate(AppRoutes.ApplicationOverview);
				} else {
					setCurrentPage(next);
				}
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("profile:errors.save_failed"));
			}
		} catch (_error) {
			setSaveError(t("profile:errors.save_failed"));
		}
	};

	const savePage6 = async () => {
		clearErrors();
		const amt =
			areOneTimePaymentsExpected && oneTimePaymentsExpectedAmount.trim()
				? Number(oneTimePaymentsExpectedAmount.replace(",", "."))
				: null;
		if (amt !== null && (isNaN(amt) || amt < 0)) {
			setSaveError(t("financial.errors.one_time_amount_invalid"));
			return;
		}

		try {
			const result = await updateSection({
				section: "financial",
				data: {
					areOneTimePaymentsExpected,
					oneTimePaymentsExpectedType: areOneTimePaymentsExpected
						? oneTimePaymentsExpectedType
						: null,
					oneTimePaymentsExpectedAmount: amt,
					oneTimePaymentsExpectedDate: areOneTimePaymentsExpected
						? oneTimePaymentsExpectedDate
						: null,
					validateEntireForm: false,
				},
			});
			if (result.success) {
				setSaveSuccess(true);
				setTimeout(() => setSaveSuccess(false), 800);
				const next = getNextPage(
					result as { data?: { wizard_evaluation?: { next_step?: string } } },
					7,
				);
				if (next === 8) {
					navigate(AppRoutes.ApplicationOverview);
				} else {
					setCurrentPage(next);
				}
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("profile:errors.save_failed"));
			}
		} catch (_error) {
			setSaveError(t("profile:errors.save_failed"));
		}
	};

	const savePage7 = async () => {
		clearErrors();
		if (
			iban.trim() &&
			!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{12,30}$/i.test(iban.trim())
		) {
			setFieldErrors({
				iban: t("financial.errors.bank_iban_invalid", "Ungültige IBAN"),
			});
			setSaveError(t("financial.errors.bank_iban_invalid", "Ungültige IBAN"));
			return;
		}

		// Sum up total monthly income, distinguishing between explicit zero and skipped
		const hasPensionAnswer = pensionTypes.length > 0;
		const hasEmploymentAnswer = employmentType !== "";
		const hasOtherAnswer = otherIncomeTypes.length > 0;

		const isPensionNone = pensionTypes.includes("none");
		const isEmploymentNone =
			employmentType === "Arbeitslos" || employmentType === "Nichts davon";
		const isOtherNone = otherIncomeTypes.includes("none");

		const isIncomeSectionAnswered =
			hasPensionAnswer || hasEmploymentAnswer || hasOtherAnswer;

		let totalIncome: number | null = null;
		if (isIncomeSectionAnswered) {
			const pAmt =
				pensionAmount === "" || isPensionNone
					? 0
					: Number(pensionAmount.replace(",", "."));
			const eAmt =
				employmentAmount === "" || isEmploymentNone
					? 0
					: Number(employmentAmount.replace(",", "."));
			const oAmt =
				otherIncomeAmount === "" || isOtherNone
					? 0
					: Number(otherIncomeAmount.replace(",", "."));
			totalIncome = pAmt + eAmt + oAmt;
		}

		try {
			const result = await updateSection({
				section: "financial",
				data: {
					bankDetails: {
						bankName: bankName.trim() || null,
						accountHolder: accountHolder.trim() || null,
						iban: iban.trim() || null,
						bic: bic.trim() || null,
					},
					monthlyIncome: totalIncome,
					validateEntireForm: false,
				},
			});
			if (result.success) {
				// Clear cached breakdown values on successful submit
				sessionStorage.removeItem("income_assets_pension_amount");
				sessionStorage.removeItem("income_assets_employment_amount");
				sessionStorage.removeItem("income_assets_other_amount");
				navigate(AppRoutes.ApplicationOverview);
			} else {
				handleValidationErrors(result.validationErrors);
				setSaveError(result.message || t("profile:errors.save_failed"));
			}
		} catch (_error) {
			setSaveError(t("profile:errors.save_failed"));
		}
	};

	const handleCheckboxChange = (
		list: string[],
		setList: (val: string[]) => void,
		val: string,
	) => {
		if (val === "none") {
			setList(["none"]);
		} else {
			const updated = list.includes(val)
				? list.filter((item) => item !== val)
				: [...list.filter((item) => item !== "none"), val];
			setList(updated);
		}
	};

	const handleBack = () => {
		if (currentPage > 1) {
			setCurrentPage(currentPage - 1);
			clearErrors();
		} else {
			navigate(AppRoutes.ApplicationIncomeAssetsIntro);
		}
	};

	if (isLoading && !profileData) {
		return (
			<PageContainer topBarProps={{ showLanguageSwitcher: true }}>
				<div className="flex items-center justify-center min-h-[50vh]">
					<Loader2 className="w-8 h-8 animate-spin text-slate-500" />
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			topBarProps={{
				onBack: handleBack,
				showLanguageSwitcher: true,
			}}
		>
			{(isUpdating || saveSuccess) && (
				<div
					role="status"
					className="fixed top-6 z-50 flex items-center gap-2.5 bg-white px-5 py-2.5 rounded-full shadow-xl border border-slate-100"
				>
					{isUpdating ? (
						<>
							<Loader2 className="w-4 h-4 animate-spin text-slate-800" />
							<span className="text-xs font-bold text-slate-800">
								{t("profile:personal.actions.saving", "Speichern...")}
							</span>
						</>
					) : (
						<>
							<CheckCircle2 className="w-4 h-4 text-green-600" />
							<span className="text-xs font-bold text-slate-800">
								{t("profile:personal.actions.saved", "Gespeichert")}
							</span>
						</>
					)}
				</div>
			)}

			{saveError && (
				<div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-900 font-medium w-full max-w-md mb-4 text-sm animate-fadeIn">
					<AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
					<p>{saveError}</p>
				</div>
			)}

			<div className="w-full max-w-md flex flex-col gap-6 text-left">
				{/* Step label */}
				<div>
					<span className="text-xs font-semibold text-brand-grey mb-1 block">
						{t("financial.steps.step_x_of_y", {
							current: currentPage,
							total: 7,
						})}
					</span>
				</div>

				{/* STEP 1: Awaiting benefits decision */}
				{currentPage === 1 && (
					<Page1AwaitingBenefits
						t={t}
						hasAppliedForBenefitsAwaitingDecision={
							hasAppliedForBenefitsAwaitingDecision
						}
						setHasAppliedForBenefitsAwaitingDecision={
							setHasAppliedForBenefitsAwaitingDecision
						}
						benefitsAwaitingDecisionType={benefitsAwaitingDecisionType}
						setBenefitsAwaitingDecisionType={setBenefitsAwaitingDecisionType}
						benefitsAwaitingDecisionApplicationDate={
							benefitsAwaitingDecisionApplicationDate
						}
						setBenefitsAwaitingDecisionApplicationDate={
							setBenefitsAwaitingDecisionApplicationDate
						}
						benefitsAwaitingDecisionOffice={benefitsAwaitingDecisionOffice}
						setBenefitsAwaitingDecisionOffice={
							setBenefitsAwaitingDecisionOffice
						}
						benefitsAwaitingDecisionReference={
							benefitsAwaitingDecisionReference
						}
						setBenefitsAwaitingDecisionReference={
							setBenefitsAwaitingDecisionReference
						}
						savePage1={savePage1}
					/>
				)}

				{/* STEP 2: Previous benefits received */}
				{currentPage === 2 && (
					<Page2PreviousBenefits
						t={t}
						hasReceivedPreviousBenefits={hasReceivedPreviousBenefits}
						setHasReceivedPreviousBenefits={setHasReceivedPreviousBenefits}
						previousBenefitsPeriod={previousBenefitsPeriod}
						setPreviousBenefitsPeriod={setPreviousBenefitsPeriod}
						previousBenefitsAuthority={previousBenefitsAuthority}
						setPreviousBenefitsAuthority={setPreviousBenefitsAuthority}
						previousBenefitsRefNo={previousBenefitsRefNo}
						setPreviousBenefitsRefNo={setPreviousBenefitsRefNo}
						savePage2={savePage2}
					/>
				)}

				{/* STEP 3: Pension Status */}
				{currentPage === 3 && (
					<Page3Pension
						t={t}
						pensionTypes={pensionTypes}
						setPensionTypes={setPensionTypes}
						handleCheckboxChange={handleCheckboxChange}
						pensionAmount={pensionAmount}
						setPensionAmount={setPensionAmount}
						savePage3={savePage3}
					/>
				)}

				{/* STEP 4: Employment Status */}
				{currentPage === 4 && (
					<Page4Employment
						t={t}
						employmentStatus={employmentType}
						setEmploymentStatus={setEmploymentType}
						jobTitle={jobTitle}
						setJobTitle={setJobTitle}
						employerName={employerName}
						setEmployerName={setEmployerName}
						incomeAmount={employmentAmount}
						setIncomeAmount={setEmploymentAmount}
						savePage4={savePage4}
					/>
				)}

				{/* STEP 5: Other regular monthly income */}
				{currentPage === 5 && (
					<Page5OtherIncome
						t={t}
						otherIncomeTypes={otherIncomeTypes}
						setOtherIncomeTypes={setOtherIncomeTypes}
						handleCheckboxChange={handleCheckboxChange}
						otherIncomeAmount={otherIncomeAmount}
						setOtherIncomeAmount={setOtherIncomeAmount}
						savePage5={savePage5}
					/>
				)}

				{/* STEP 6: Expected one-time payments */}
				{currentPage === 6 && (
					<Page6OneTime
						t={t}
						areOneTimePaymentsExpected={areOneTimePaymentsExpected}
						setAreOneTimePaymentsExpected={setAreOneTimePaymentsExpected}
						oneTimePaymentsExpectedType={oneTimePaymentsExpectedType}
						setOneTimePaymentsExpectedType={setOneTimePaymentsExpectedType}
						oneTimePaymentsExpectedAmount={oneTimePaymentsExpectedAmount}
						setOneTimePaymentsExpectedAmount={setOneTimePaymentsExpectedAmount}
						oneTimePaymentsExpectedDate={oneTimePaymentsExpectedDate}
						setOneTimePaymentsExpectedDate={setOneTimePaymentsExpectedDate}
						savePage6={savePage6}
					/>
				)}

				{/* STEP 7: Bank Details */}
				{currentPage === 7 && (
					<Page7Bank
						t={t}
						accountHolder={accountHolder}
						setAccountHolder={setAccountHolder}
						bankName={bankName}
						setBankName={setBankName}
						iban={iban}
						setIban={setIban}
						bic={bic}
						setBic={setBic}
						fieldErrors={fieldErrors}
						setFieldErrors={setFieldErrors}
						savePage7={savePage7}
					/>
				)}
			</div>
		</PageContainer>
	);
};
