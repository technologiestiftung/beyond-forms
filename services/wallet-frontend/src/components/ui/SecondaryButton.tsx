import React from "react";

export interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children: React.ReactNode;
}

export const SecondaryButton = React.forwardRef<
	HTMLButtonElement,
	SecondaryButtonProps
>(({ className = "", children, type = "button", disabled, ...props }, ref) => {
	return (
		<button
			ref={ref}
			type={type}
			disabled={disabled}
			className={`inline-flex items-center justify-center rounded-full w-full bg-primary-blue-500 text-white text-body-lg font-medium min-h-12 px-10 py-2.5 transition-colors hover:bg-primary-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-blue-500 ${className}`}
			{...props}
		>
			{children}
		</button>
	);
});

SecondaryButton.displayName = "SecondaryButton";
