import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Pencil } from "lucide-react";
import type { UseFormRegisterReturn, UseFormRegister } from "react-hook-form";
import type { CombinedWizardFormValues } from "./types";

export interface FieldProps {
	id: string;
	label: string;
	type?: string;
	placeholder?: string;
	register: UseFormRegisterReturn;
	onBlur?: () => void;
	error?: string;
	hint?: string;
}

export const FormField: React.FC<FieldProps> = ({
	id,
	label,
	type = "text",
	placeholder,
	register,
	onBlur,
	error,
	hint,
}) => {
	const { t } = useTranslation("profile");
	const errorId = `${id}-error`;
	const hintId = `${id}-hint`;
	const describedBy = [error ? errorId : null, hint ? hintId : null]
		.filter(Boolean)
		.join(" ");

	return (
		<div className="flex flex-col gap-1 text-left relative pb-3 border-b border-slate-100 last:border-b-0 focus-within:border-primary-green-300 transition-all">
			<label
				htmlFor={id}
				className="text-xs font-bold text-slate-500 uppercase tracking-wide"
			>
				{label}
			</label>
			<div className="relative flex items-center w-full mt-0.5">
				<input
					id={id}
					type={type}
					placeholder={placeholder}
					{...register}
					onChange={(e) => {
						if (type === "number" || register.name === "zipCode") {
							e.target.value = e.target.value.replace(/[^0-9.,]/g, "");
						}
						void register.onChange(e);
					}}
					onBlur={(e) => {
						void register.onBlur(e);
						onBlur?.();
					}}
					aria-invalid={!!error}
					aria-describedby={describedBy || undefined}
					data-testid={`field-${id}-input`}
					className="w-full pr-14 bg-transparent border-none focus:outline-none font-bold text-slate-900 text-base placeholder:font-normal placeholder:text-brand-grey"
				/>
				<button
					type="button"
					aria-label={`${label} bearbeiten`}
					onClick={() => document.getElementById(id)?.focus()}
					className="absolute right-0 min-w-[44px] min-h-[44px] size-11 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 cursor-pointer transition-all active:scale-95 shadow-sm shrink-0 focus-visible:outline-2 focus-visible:outline-brand-primary"
				>
					<Pencil className="size-4" />
				</button>
			</div>
			{hint && (
				<p
					id={hintId}
					className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 px-1"
				>
					{hint}
				</p>
			)}
			{error && (
				<span
					id={errorId}
					data-testid={`field-${id}-error`}
					className="text-xs text-rose-600 font-semibold mt-1"
				>
					{t(error)}
				</span>
			)}
		</div>
	);
};

export const SelectField: React.FC<
	FieldProps & {
		options: { code: string; name: string }[];
		placeholderText: string;
	}
> = ({
	id,
	label,
	register,
	onBlur,
	error,
	hint,
	options,
	placeholderText,
}) => {
	const { t } = useTranslation("profile");
	const errorId = `${id}-error`;
	const hintId = `${id}-hint`;
	const describedBy = [error ? errorId : null, hint ? hintId : null]
		.filter(Boolean)
		.join(" ");

	return (
		<div className="flex flex-col gap-1.5 text-left w-full">
			<label
				htmlFor={id}
				className="text-xs font-bold text-slate-500 uppercase tracking-wide"
			>
				{label}
			</label>
			{/* Native select arrows ignore padding-right, so it is replaced by a
			positioned chevron to control the spacing towards the right edge. */}
			<div className="relative w-full">
				<select
					id={id}
					{...register}
					onBlur={(e) => {
						void register.onBlur(e);
						onBlur?.();
					}}
					aria-invalid={!!error}
					aria-describedby={describedBy || undefined}
					data-testid={`field-${id}-select`}
					className={`appearance-none w-full h-12 pl-4 pr-12 rounded-xl border ${error ? "border-rose-400 focus:ring-rose-200" : "border-slate-200 focus:ring-primary-green-200"} focus:outline-none focus:ring-2 focus:ring-primary-green-500/20 bg-slate-50/50 font-medium text-slate-800 text-sm transition-all cursor-pointer`}
				>
					<option value="">{placeholderText}</option>
					{options.map((o) => (
						<option key={o.code} value={o.code}>
							{o.name}
						</option>
					))}
				</select>
				<ChevronDown
					className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 size-4 text-slate-500"
					aria-hidden="true"
				/>
			</div>
			{hint && (
				<p
					id={hintId}
					className="text-[11px] text-slate-500 font-medium leading-relaxed px-1 mt-0.5"
				>
					{hint}
				</p>
			)}
			{error && (
				<span
					id={errorId}
					data-testid={`field-${id}-error`}
					className="text-xs text-rose-600 font-semibold mt-0.5"
				>
					{t(error)}
				</span>
			)}
		</div>
	);
};

export const CheckboxField: React.FC<{
	id: string;
	label: string;
	register: UseFormRegisterReturn;
	onBlur?: () => void;
	hint?: string;
}> = ({ id, label, register, onBlur, hint }) => {
	return (
		<label
			htmlFor={id}
			className="flex items-start gap-3 text-left py-2 border-b border-slate-100 last:border-b-0 cursor-pointer"
		>
			<input
				id={id}
				type="checkbox"
				{...register}
				onBlur={(e) => {
					void register.onBlur(e);
					onBlur?.();
				}}
				data-testid={`field-${id}-checkbox`}
				className="mt-0.5 size-5 shrink-0 rounded border-slate-300 text-primary-green-500 focus:ring-primary-green-500/40"
			/>
			<span className="flex flex-col gap-0.5">
				<span className="text-sm font-bold text-slate-800">{label}</span>
				{hint && <span className="text-[11px] text-slate-500">{hint}</span>}
			</span>
		</label>
	);
};

/**
 * A checkbox group sharing a single registered field name, so react-hook-form
 * collects the checked values into a string array (used for e.g. incomeSources).
 */
export const MultiCheckboxField: React.FC<{
	legend: string;
	name: keyof CombinedWizardFormValues & string;
	options: { code: string; name: string }[];
	register: UseFormRegister<CombinedWizardFormValues>;
	onBlur?: () => void;
}> = ({ legend, name, options, register, onBlur }) => {
	return (
		<fieldset className="flex flex-col gap-2 text-left w-full">
			<legend className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
				{legend}
			</legend>
			<div className="flex flex-wrap gap-2">
				{options.map((o) => (
					<label
						key={o.code}
						htmlFor={`${name}-${o.code}`}
						className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer has-checked:border-primary-green-300 has-checked:bg-primary-green-50"
					>
						<input
							id={`${name}-${o.code}`}
							type="checkbox"
							value={o.code}
							{...register(name)}
							onBlur={(e) => {
								void register(name).onBlur(e);
								onBlur?.();
							}}
							className="size-3.5 rounded border-slate-300 text-primary-green-500 focus:ring-primary-green-500/40"
						/>
						{o.name}
					</label>
				))}
			</div>
		</fieldset>
	);
};
