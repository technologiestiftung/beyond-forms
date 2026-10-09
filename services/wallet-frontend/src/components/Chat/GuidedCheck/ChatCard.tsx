import React from "react";

export const ChatCard: React.FC<{
	children: React.ReactNode;
	testId?: string;
}> = ({ children, testId }) => (
	<div
		data-testid={testId}
		className="w-full max-w-[85%] rounded-2xl border border-brand-border-subtle bg-white p-5 shadow-cards flex flex-col gap-4"
	>
		{children}
	</div>
);

export const ChipButton: React.FC<
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: "solid" | "outline";
	}
> = ({ variant = "outline", className = "", type = "button", ...props }) => (
	<button
		type={type}
		className={`rounded-full px-4 py-2 text-[14px] font-medium text-left transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue-500 ${
			variant === "solid"
				? "bg-primary-green-500 text-primary-blue-500 hover:bg-primary-green-300"
				: "border-2 border-brand-border bg-white text-brand-black hover:border-primary-blue-300 hover:bg-brand-bg"
		} ${className}`}
		{...props}
	/>
);
