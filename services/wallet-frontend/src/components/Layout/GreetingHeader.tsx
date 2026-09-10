import React from "react";
import profileIllustration from "../../assets/illustrations/profile.svg";

interface GreetingHeaderProps {
	title: string;
	subtitle?: React.ReactNode;
	headingTestId?: string;
}

export const GreetingHeader: React.FC<GreetingHeaderProps> = ({
	title,
	subtitle,
	headingTestId,
}) => {
	return (
		<div className="flex flex-col items-start gap-4 w-full min-w-0 lg:gap-6">
			<div className="flex flex-row items-center gap-4 w-full min-w-0">
				<img
					src={profileIllustration}
					alt=""
					className="size-11 shrink-0 rounded-full bg-white lg:size-14"
					aria-hidden
				/>
				<h1
					data-testid={headingTestId}
					className="text-h1 font-bold text-brand-black min-w-0 wrap-break-word lg:text-[32px] lg:leading-10"
				>
					{title}
				</h1>
			</div>

			{subtitle && (
				<p className="text-brand-black text-body-lg wrap-break-word">
					{subtitle}
				</p>
			)}
		</div>
	);
};
