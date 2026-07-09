import React from "react";
import { motion } from "framer-motion";

interface ProgressBarProps {
	current: number;
	total: number;
	colorVariant?: "blue" | "green";
	ariaLabel?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
	current,
	total,
	colorVariant = "blue",
	ariaLabel,
}) => {
	const percentage = (current / total) * 100;
	const barColorClass =
		colorVariant === "green" ? "bg-primary-green-500" : "bg-primary-blue-500";
	const trackColorClass =
		colorVariant === "green" ? "bg-slate-200" : "bg-primary-blue-100";

	return (
		<div className="w-full font-sans flex flex-col gap-1.5 mb-6">
			<div
				className={`relative w-full h-2 rounded-full overflow-hidden ${trackColorClass}`}
				role="progressbar"
				aria-valuenow={current}
				aria-valuemin={1}
				aria-valuemax={total}
				aria-label={ariaLabel || `${current} of ${total}`}
			>
				<motion.div
					className={`absolute inset-y-0 left-0 rounded-full ${barColorClass}`}
					initial={{ width: 0 }}
					animate={{ width: `${Math.min(percentage, 100)}%` }}
					transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
				/>
			</div>
		</div>
	);
};
