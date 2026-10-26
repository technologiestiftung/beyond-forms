import React from "react";
import { FormField, CheckboxField, MultiCheckboxField } from "../fields";
import { emptyStringToUndefinedNumber } from "../formDefaults";
import type { SectionProps } from "../types";

const INCOME_SOURCE_OPTIONS = [
	"pension",
	"none_pension",
	"employment_employed",
	"employment_self",
	"employment_student",
	"employment_unemployed",
	"employment_none",
	"other_benefits",
	"other_alimony",
	"other_rent",
	"other_sick",
	"other",
	"none_other",
] as const;

export const FinancialSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.financial")}
			</h2>
			<FormField
				id="monthlyIncome"
				label={t("personal.fields.monthlyIncome")}
				type="number"
				register={register("monthlyIncome", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("monthlyIncome")}
			/>
			<MultiCheckboxField
				legend={t("personal.fields.incomeSources")}
				name="incomeSources"
				register={register}
				onBlur={() => handleFieldBlur("incomeSources")}
				options={INCOME_SOURCE_OPTIONS.map((code) => ({
					code,
					name: t(`personal.incomeSources.${code}`, code),
				}))}
			/>
			<CheckboxField
				id="hasAssets"
				label={t("personal.fields.hasAssets")}
				register={register("hasAssets")}
				onBlur={() => handleFieldBlur("hasAssets")}
			/>
			<FormField
				id="assetsDescription"
				label={t("personal.fields.assetsDescription")}
				register={register("assetsDescription")}
				onBlur={() => handleFieldBlur("assetsDescription")}
			/>
			<FormField
				id="professionalExpenses"
				label={t("personal.fields.professionalExpenses")}
				type="number"
				register={register("professionalExpenses", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("professionalExpenses")}
			/>
			<CheckboxField
				id="hasChildcareExpenses"
				label={t("personal.fields.hasChildcareExpenses")}
				register={register("hasChildcareExpenses")}
				onBlur={() => handleFieldBlur("hasChildcareExpenses")}
			/>
			<CheckboxField
				id="gaveAwayAssetsLast10Years"
				label={t("personal.fields.gaveAwayAssetsLast10Years")}
				register={register("gaveAwayAssetsLast10Years")}
				onBlur={() => handleFieldBlur("gaveAwayAssetsLast10Years")}
			/>
			<CheckboxField
				id="grossNegligenceLast10Years"
				label={t("personal.fields.grossNegligenceLast10Years")}
				register={register("grossNegligenceLast10Years")}
				onBlur={() => handleFieldBlur("grossNegligenceLast10Years")}
			/>
			<CheckboxField
				id="hasAppliedForBenefitsAwaitingDecision"
				label={t("personal.fields.hasAppliedForBenefitsAwaitingDecision")}
				register={register("hasAppliedForBenefitsAwaitingDecision")}
				onBlur={() => handleFieldBlur("hasAppliedForBenefitsAwaitingDecision")}
			/>
			<FormField
				id="benefitsAwaitingDecisionType"
				label={t("personal.fields.benefitsAwaitingDecisionType")}
				register={register("benefitsAwaitingDecisionType")}
				onBlur={() => handleFieldBlur("benefitsAwaitingDecisionType")}
			/>
			<FormField
				id="benefitsAwaitingDecisionApplicationDate"
				label={t("personal.fields.benefitsAwaitingDecisionApplicationDate")}
				type="date"
				register={register("benefitsAwaitingDecisionApplicationDate")}
				onBlur={() =>
					handleFieldBlur("benefitsAwaitingDecisionApplicationDate")
				}
			/>
			<FormField
				id="benefitsAwaitingDecisionOffice"
				label={t("personal.fields.benefitsAwaitingDecisionOffice")}
				register={register("benefitsAwaitingDecisionOffice")}
				onBlur={() => handleFieldBlur("benefitsAwaitingDecisionOffice")}
			/>
			<FormField
				id="benefitsAwaitingDecisionReference"
				label={t("personal.fields.benefitsAwaitingDecisionReference")}
				register={register("benefitsAwaitingDecisionReference")}
				onBlur={() => handleFieldBlur("benefitsAwaitingDecisionReference")}
			/>
			<CheckboxField
				id="areOneTimePaymentsExpected"
				label={t("personal.fields.areOneTimePaymentsExpected")}
				register={register("areOneTimePaymentsExpected")}
				onBlur={() => handleFieldBlur("areOneTimePaymentsExpected")}
			/>
			<FormField
				id="oneTimePaymentsExpectedType"
				label={t("personal.fields.oneTimePaymentsExpectedType")}
				register={register("oneTimePaymentsExpectedType")}
				onBlur={() => handleFieldBlur("oneTimePaymentsExpectedType")}
			/>
			<FormField
				id="oneTimePaymentsExpectedAmount"
				label={t("personal.fields.oneTimePaymentsExpectedAmount")}
				type="number"
				register={register("oneTimePaymentsExpectedAmount", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("oneTimePaymentsExpectedAmount")}
			/>
			<FormField
				id="oneTimePaymentsExpectedDate"
				label={t("personal.fields.oneTimePaymentsExpectedDate")}
				type="date"
				register={register("oneTimePaymentsExpectedDate")}
				onBlur={() => handleFieldBlur("oneTimePaymentsExpectedDate")}
			/>
			<FormField
				id="bankName"
				label={t("personal.fields.bankName")}
				register={register("bankName")}
				onBlur={() => handleFieldBlur("bankName")}
			/>
			<FormField
				id="accountHolder"
				label={t("personal.fields.accountHolder")}
				register={register("accountHolder")}
				onBlur={() => handleFieldBlur("accountHolder")}
			/>
			<FormField
				id="iban"
				label={t("personal.fields.iban")}
				register={register("iban")}
				onBlur={() => handleFieldBlur("iban")}
			/>
			<FormField
				id="bic"
				label={t("personal.fields.bic")}
				register={register("bic")}
				onBlur={() => handleFieldBlur("bic")}
			/>
		</div>
	);
};
