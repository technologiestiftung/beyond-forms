import React from "react";
import { FormField } from "../fields";
import { emptyStringToUndefinedNumber } from "../formDefaults";
import type { SectionProps } from "../types";

export const HouseholdSection: React.FC<SectionProps> = ({
	register,
	handleFieldBlur,
	t,
}) => {
	return (
		<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 w-full">
			<h2 className="text-sm font-extrabold text-slate-950 tracking-wide uppercase mb-1">
				{t("personal.groups.household", "Haushalt")}
			</h2>
			<FormField
				id="personsInHouseholdCount"
				label={t(
					"personal.fields.personsInHouseholdCount",
					"Personen im Haushalt",
				)}
				type="number"
				register={register("personsInHouseholdCount", {
					setValueAs: emptyStringToUndefinedNumber,
				})}
				onBlur={() => handleFieldBlur("personsInHouseholdCount")}
			/>
			<FormField
				id="marriedSince"
				label={t("personal.fields.marriedSince", "Verheiratet seit")}
				type="date"
				register={register("marriedSince")}
				onBlur={() => handleFieldBlur("marriedSince")}
			/>
		</div>
	);
};
