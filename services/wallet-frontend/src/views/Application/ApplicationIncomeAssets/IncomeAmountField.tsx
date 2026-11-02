import React from "react";
import { useTranslation } from "react-i18next";

interface IncomeAmountFieldProps {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
}

export const IncomeAmountField: React.FC<IncomeAmountFieldProps> = ({
	id,
	label,
	value,
	onChange,
	placeholder,
}) => {
	const { t } = useTranslation("application");

	return (
		<div className="flex flex-col gap-1.5 animate-fadeIn">
			<label htmlFor={id} className="text-xs font-extrabold text-slate-800">
				{label}
			</label>
			<div className="relative">
				<span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand-grey">
					€
				</span>
				<input
					id={id}
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value.replace(/[^0-9,.]/g, ""))}
					placeholder={placeholder}
					className="w-full pl-8 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-blue-500 focus:outline-none"
				/>
			</div>
			<p className="text-[11px] font-semibold text-slate-500 mt-1">
				{t("financial.questions.amount_net_hint")}
			</p>
		</div>
	);
};
