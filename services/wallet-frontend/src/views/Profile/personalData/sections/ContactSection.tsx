import React from "react";
import { FormField } from "../fields";
import type { SectionProps } from "../types";

export const ContactSection: React.FC<SectionProps> = ({
	register,
	formErrors,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.contact", "Kontakt")}
			</h2>
			<FormField
				id="email"
				label={t("personal.fields.email", "E-Mail-Adresse")}
				type="email"
				register={register("email")}
				onBlur={() => handleFieldBlur("email")}
				error={formErrors.email?.message}
			/>
			<FormField
				id="phoneNumber"
				label={t("personal.fields.phoneNumber", "Telefonnummer")}
				register={register("phoneNumber")}
				onBlur={() => handleFieldBlur("phoneNumber")}
				error={formErrors.phoneNumber?.message}
			/>
		</div>
	);
};
