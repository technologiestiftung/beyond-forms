import React from "react";
import { FormField, SelectField } from "../fields";
import type { SectionProps } from "../types";

export const AddressSection: React.FC<SectionProps> = ({
	register,
	formErrors,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.address", "Meldeadresse")}
			</h2>
			<FormField
				id="street"
				label={t("personal.fields.street")}
				register={register("street")}
				onBlur={() => handleFieldBlur("street")}
				error={formErrors.street?.message}
			/>
			<FormField
				id="houseNumber"
				label={t("personal.fields.houseNumber")}
				register={register("houseNumber")}
				onBlur={() => handleFieldBlur("houseNumber")}
				error={formErrors.houseNumber?.message}
			/>
			<SelectField
				id="city"
				label={t("personal.fields.city")}
				register={register("city")}
				onBlur={() => handleFieldBlur("city")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={[{ code: "Berlin", name: "Berlin" }]}
				error={formErrors.city?.message}
			/>
			<SelectField
				id="state"
				label={t("personal.fields.state")}
				register={register("state")}
				onBlur={() => handleFieldBlur("state")}
				placeholderText={`-- ${t("common.please_select", "Bitte auswählen")} --`}
				options={[{ code: "Berlin", name: "Berlin" }]}
			/>
			<FormField
				id="zipCode"
				label={t("personal.fields.zipCode")}
				register={register("zipCode")}
				onBlur={() => handleFieldBlur("zipCode")}
				error={formErrors.zipCode?.message}
			/>
		</div>
	);
};
