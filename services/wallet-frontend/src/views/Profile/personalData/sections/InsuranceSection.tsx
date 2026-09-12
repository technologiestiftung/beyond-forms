import React from "react";
import { FormField, SelectField, CheckboxField } from "../fields";
import type { SectionProps } from "../types";

const SOCIAL_SECURITY_OPTIONS = [
	"None",
	"Pension Insurance",
	"Long-term Care Insurance",
] as const;

const HEALTH_INSURANCE_STATUS_OPTIONS = [
	"Compulsory Insurance",
	"Voluntary Insurance",
	"Family Insurance",
	"Private Insurance",
	"Care by Health Funds under § 264 SGB V",
] as const;

export const InsuranceSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.insurance", "Versicherung und Erwerbstätigkeit")}
			</h2>
			<SelectField
				id="socialSecurityType"
				label={t("personal.fields.socialSecurityType", "Sozialversicherung")}
				register={register("socialSecurityType")}
				onBlur={() => handleFieldBlur("socialSecurityType")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={SOCIAL_SECURITY_OPTIONS.map((code) => ({
					code,
					name: t(`personal.socialSecurityType.${code}`, code),
				}))}
			/>
			<SelectField
				id="healthInsuranceStatus"
				label={t(
					"personal.fields.healthInsuranceStatus",
					"Art der Krankenversicherung",
				)}
				register={register("healthInsuranceStatus")}
				onBlur={() => handleFieldBlur("healthInsuranceStatus")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={HEALTH_INSURANCE_STATUS_OPTIONS.map((code) => ({
					code,
					name: t(`personal.healthInsuranceStatus.${code}`, code),
				}))}
			/>
			<FormField
				id="healthInsuranceProvider"
				label={t("personal.fields.healthInsuranceProvider", "Krankenkasse")}
				register={register("healthInsuranceProvider")}
				onBlur={() => handleFieldBlur("healthInsuranceProvider")}
			/>
			<FormField
				id="pensionInsuranceProvider"
				label={t(
					"personal.fields.pensionInsuranceProvider",
					"Rentenversicherungsträger",
				)}
				register={register("pensionInsuranceProvider")}
				onBlur={() => handleFieldBlur("pensionInsuranceProvider")}
			/>
			<FormField
				id="pensionInsuranceNo"
				label={t(
					"personal.fields.pensionInsuranceNo",
					"Rentenversicherungsnummer",
				)}
				register={register("pensionInsuranceNo")}
				onBlur={() => handleFieldBlur("pensionInsuranceNo")}
			/>
			<CheckboxField
				id="isCurrentlyEmployed"
				label={t(
					"personal.fields.isCurrentlyEmployed",
					"Ich bin aktuell erwerbstätig",
				)}
				register={register("isCurrentlyEmployed")}
				onBlur={() => handleFieldBlur("isCurrentlyEmployed")}
			/>
			<CheckboxField
				id="isStudentOrTrainee"
				label={t(
					"personal.fields.isStudentOrTrainee",
					"Ich bin Schüler(in), Studierende(r) oder Auszubildende(r)",
				)}
				register={register("isStudentOrTrainee")}
				onBlur={() => handleFieldBlur("isStudentOrTrainee")}
			/>
			<CheckboxField
				id="hasAppliedForAsylumBenefits"
				label={t(
					"personal.fields.hasAppliedForAsylumBenefits",
					"Ich habe Leistungen nach dem Asylbewerberleistungsgesetz beantragt",
				)}
				register={register("hasAppliedForAsylumBenefits")}
				onBlur={() => handleFieldBlur("hasAppliedForAsylumBenefits")}
			/>
			<CheckboxField
				id="hasReceivedPreviousBenefits"
				label={t(
					"personal.fields.hasReceivedPreviousBenefits",
					"Ich habe bereits einmal Sozialleistungen erhalten",
				)}
				register={register("hasReceivedPreviousBenefits")}
				onBlur={() => handleFieldBlur("hasReceivedPreviousBenefits")}
			/>
			<FormField
				id="previousBenefitsAuthority"
				label={t(
					"personal.fields.previousBenefitsAuthority",
					"Bewilligende Behörde",
				)}
				register={register("previousBenefitsAuthority")}
				onBlur={() => handleFieldBlur("previousBenefitsAuthority")}
			/>
			<FormField
				id="previousBenefitsPeriod"
				label={t(
					"personal.fields.previousBenefitsPeriod",
					"Bewilligungszeitraum",
				)}
				register={register("previousBenefitsPeriod")}
				onBlur={() => handleFieldBlur("previousBenefitsPeriod")}
			/>
			<FormField
				id="previousBenefitsRefNo"
				label={t("personal.fields.previousBenefitsRefNo", "Aktenzeichen")}
				register={register("previousBenefitsRefNo")}
				onBlur={() => handleFieldBlur("previousBenefitsRefNo")}
			/>
		</div>
	);
};
