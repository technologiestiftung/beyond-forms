import React from "react";
import { FormField, SelectField, CheckboxField } from "../fields";
import type { SectionProps } from "../types";
import { COUNTRY_OPTIONS } from "../../../../constants/countries";

export const IdentitySection: React.FC<SectionProps> = ({
	register,
	formErrors,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.identity", "Rechtliche Identität")}
			</h2>

			<SelectField
				id="legalGender"
				label={t("personal.fields.legalGender")}
				register={register("legalGender")}
				onBlur={() => handleFieldBlur("legalGender")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={[
					{ code: "Female", name: t("personal.gender.Female") },
					{ code: "Male", name: t("personal.gender.Male") },
					{ code: "Diverse", name: t("personal.gender.Diverse") },
				]}
				error={formErrors.legalGender?.message}
				hint={t("personal.gender.hint")}
			/>

			<FormField
				id="firstName"
				label={t("personal.fields.firstName")}
				register={register("firstName")}
				onBlur={() => handleFieldBlur("firstName")}
				error={formErrors.firstName?.message}
			/>
			<FormField
				id="lastName"
				label={t("personal.fields.lastName")}
				register={register("lastName")}
				onBlur={() => handleFieldBlur("lastName")}
				error={formErrors.lastName?.message}
			/>
			<FormField
				id="birthName"
				label={t("personal.fields.birthName")}
				register={register("birthName")}
				onBlur={() => handleFieldBlur("birthName")}
			/>
			<FormField
				id="dateOfBirth"
				label={t("personal.fields.dateOfBirth")}
				type="date"
				register={register("dateOfBirth")}
				onBlur={() => handleFieldBlur("dateOfBirth")}
				error={formErrors.dateOfBirth?.message}
			/>
			<SelectField
				id="placeOfBirth"
				label={t("personal.fields.placeOfBirth")}
				register={register("placeOfBirth")}
				onBlur={() => handleFieldBlur("placeOfBirth")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={COUNTRY_OPTIONS.map((c) => ({
					code: c.code,
					name: t(`personal.countries.${c.code}`),
				}))}
				error={formErrors.placeOfBirth?.message}
			/>
			<CheckboxField
				id="isGermanCitizen"
				label={t(
					"personal.fields.isGermanCitizen",
					"Ich bin deutsche(r) Staatsbürger(in)",
				)}
				register={register("isGermanCitizen")}
				onBlur={() => handleFieldBlur("isGermanCitizen")}
			/>
			<CheckboxField
				id="isResidentInGermany"
				label={t(
					"personal.fields.isResidentInGermany",
					"Ich habe meinen gewöhnlichen Aufenthalt in Deutschland",
				)}
				register={register("isResidentInGermany")}
				onBlur={() => handleFieldBlur("isResidentInGermany")}
			/>
			<CheckboxField
				id="isVictimOfNationalSocialistPersecution"
				label={t(
					"personal.fields.isVictimOfNationalSocialistPersecution",
					"Ich bin Verfolgte(r) des Nationalsozialismus",
				)}
				register={register("isVictimOfNationalSocialistPersecution")}
				onBlur={() => handleFieldBlur("isVictimOfNationalSocialistPersecution")}
			/>
		</div>
	);
};
