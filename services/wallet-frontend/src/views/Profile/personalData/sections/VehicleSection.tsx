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
				{t("personal.groups.vehicle")}
			</h2>
			<FormField
				id="licensePlate"
				label={t("personal.fields.licensePlate")}
				placeholder={t("personal.fields.licensePlate_placeholder")}
				register={register("licensePlate")}
				onBlur={() => handleFieldBlur("licensePlate")}
				hint={t("personal.fields.licensePlate_hint")}
			/>
		</div>
	);
};
