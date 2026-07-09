import React from "react";

export interface ToggleOption<T extends string = string> {
	value: T;
	label: React.ReactNode;
}

export interface ToggleProps<T extends string = string> {
	options: readonly ToggleOption<T>[];
	value: T;
	onChange: (value: T) => void;
	className?: string;
	"aria-label"?: string;
}

export function Toggle<T extends string = string>({
	options,
	value,
	onChange,
	className = "",
	"aria-label": ariaLabel,
}: ToggleProps<T>): React.ReactElement {
	return (
		<div
			role="group"
			aria-label={ariaLabel}
			className={`flex items-center w-full rounded-full bg-brand-border-subtle p-0.5 ${className}`}
		>
			{options.map((opt) => {
				const isActive = opt.value === value;
				return (
					<button
						key={opt.value}
						type="button"
						aria-pressed={isActive}
						onClick={() => onChange(opt.value)}
						className={`flex-1 rounded-full py-1.5 text-base leading-[21px] font-medium text-primary-blue-500 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue-500 ${
							isActive ? "bg-white" : "bg-transparent hover:bg-white/40"
						}`}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}

Toggle.displayName = "Toggle";
