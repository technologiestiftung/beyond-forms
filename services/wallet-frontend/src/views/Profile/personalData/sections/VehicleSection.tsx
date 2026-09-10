import React from "react";
import { FormField } from "../fields";
import type { SectionProps } from "../types";

export const VehicleSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.vehicle", "Fahrzeug")}
			</h2>
			<FormField
				id="licensePlate"
				label={t("personal.fields.licensePlate", "Kfz-Kennzeichen")}
				placeholder={t(
					"personal.fields.licensePlate_placeholder",
					"z. B. B-XY 1234",
				)}
				register={register("licensePlate")}
				onBlur={() => handleFieldBlur("licensePlate")}
				hint={t(
					"personal.fields.licensePlate_hint",
					"Wird für den Bewohnerparkausweis benötigt.",
				)}
			/>
		</div>
	);
};
