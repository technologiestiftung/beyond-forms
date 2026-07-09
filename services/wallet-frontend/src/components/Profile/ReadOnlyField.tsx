import React from "react";

interface ReadOnlyFieldProps {
	label: string;
	value?: string;
	fallback?: string;
	testId?: string;
}

export const ReadOnlyField: React.FC<ReadOnlyFieldProps> = ({
	label,
	value,
	fallback = "-",
	testId,
}) => {
	return (
		<div className="w-full flex flex-col gap-1 py-3 border-b border-brand-border-subtle last:border-0">
			<span className="text-xs font-medium text-brand-black uppercase tracking-wider">
				{label}
			</span>
			<span
				data-testid={testId}
				className="text-body-lg font-semibold text-brand-carbon"
			>
				{value || fallback}
			</span>
		</div>
	);
};
