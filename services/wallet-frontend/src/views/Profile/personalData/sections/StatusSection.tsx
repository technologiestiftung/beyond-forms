import React from "react";
import { FormField, SelectField, CheckboxField } from "../fields";
import type { SectionProps } from "../types";
import { COUNTRY_OPTIONS } from "../../../../constants/countries";

const DISPLACED_STATUS_OPTIONS = [
	"Expellee (Resettler)",
	"Displaced Person (Resettler)",
	"Late Resettler",
	"Spouse or Descendant of a Late Resettler",
	"Soviet Zone Refugee",
	"none",
] as const;

export const StatusSection: React.FC<SectionProps> = ({
	register,
	formErrors,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.status", "Staatsangehörigkeit und Status")}
			</h2>
			<SelectField
				id="nationality"
				label={t("personal.fields.nationality")}
				register={register("nationality")}
				onBlur={() => handleFieldBlur("nationality")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={COUNTRY_OPTIONS.map((c) => ({
					code: c.code,
					name: t(`personal.countries.${c.code}`),
				}))}
				error={formErrors.nationality?.message}
			/>
			<SelectField
				id="secondNationality"
				label={t("personal.fields.secondNationality")}
				register={register("secondNationality")}
				onBlur={() => handleFieldBlur("secondNationality")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={COUNTRY_OPTIONS.map((c) => ({
					code: c.code,
					name: t(`personal.countries.${c.code}`),
				}))}
			/>
			<FormField
				id="residenceStatus"
				label={t("personal.fields.residenceStatus")}
				register={register("residenceStatus")}
				onBlur={() => handleFieldBlur("residenceStatus")}
			/>
			<SelectField
				id="maritalStatus"
				label={t("personal.fields.maritalStatus")}
				register={register("maritalStatus")}
				onBlur={() => handleFieldBlur("maritalStatus")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={[
					{ code: "Single", name: t("personal.maritalStatus.Single") },
					{ code: "Married", name: t("personal.maritalStatus.Married") },
					{ code: "Divorced", name: t("personal.maritalStatus.Divorced") },
					{ code: "Widowed", name: t("personal.maritalStatus.Widowed") },
					{
						code: "Registered Civil Partnership",
						name: t("personal.maritalStatus.Registered Civil Partnership"),
					},
				]}
				error={formErrors.maritalStatus?.message}
			/>
			<SelectField
				id="displacedStatus"
				label={t("personal.fields.displacedStatus", "Vertriebenenstatus")}
				register={register("displacedStatus")}
				onBlur={() => handleFieldBlur("displacedStatus")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={DISPLACED_STATUS_OPTIONS.map((code) => ({
					code,
					name: t(`personal.displacedStatus.${code}`, code),
				}))}
			/>
			<FormField
				id="identificationNumbers"
				label={t("personal.fields.identificationNumbers")}
				register={register("identificationNumbers")}
				onBlur={() => handleFieldBlur("identificationNumbers")}
			/>
			<FormField
				id="taxId"
				label={t("personal.fields.taxId")}
				register={register("taxId")}
				onBlur={() => handleFieldBlur("taxId")}
			/>
			<CheckboxField
				id="hasGuardian"
				label={t("personal.fields.hasGuardian", "Ich werde rechtlich betreut")}
				register={register("hasGuardian")}
				onBlur={() => handleFieldBlur("hasGuardian")}
			/>
			<CheckboxField
				id="hasCustodian"
				label={t("personal.fields.hasCustodian", "Ich habe Beistand")}
				register={register("hasCustodian")}
				onBlur={() => handleFieldBlur("hasCustodian")}
			/>
		</div>
	);
};
