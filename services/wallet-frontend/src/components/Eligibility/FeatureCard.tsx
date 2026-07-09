import React from "react";

interface FeatureCardProps {
	icon: React.ReactNode;
	title: string;
	description: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
	icon,
	title,
	description,
}) => {
	return (
		<div className="flex gap-3 items-start w-full">
			<div className="shrink-0 size-8 flex items-center justify-center">
				{icon}
			</div>
			<div className="flex flex-col gap-1">
				<h2 className="text-brand-black text-lg font-bold leading-tight">
					{title}
				</h2>
				<p className="text-brand-black text-sm leading-relaxed font-medium">
					{description}
				</p>
			</div>
		</div>
	);
};
