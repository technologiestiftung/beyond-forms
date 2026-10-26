import React from "react";
import type { LucideIcon } from "lucide-react";
import { PageContainer } from "../Layout/PageContainer";

interface PathOptionProps {
	icon: LucideIcon;
	title: string;
	description: string;
	onClick: () => void;
}

export const PathOption: React.FC<PathOptionProps> = ({
	icon: Icon,
	title,
	description,
	onClick,
}) => (
	<button
		type="button"
		onClick={onClick}
		className="flex items-center gap-4 p-4 bg-white border border-slate-100 hover:border-slate-200 focus-visible:ring-2 focus-visible:ring-primary-blue-500 focus-visible:ring-offset-2 focus:outline-none rounded-2xl w-full text-left transition-all shadow-sm group lg:flex-col lg:items-start lg:gap-5 lg:p-6 lg:rounded-3xl lg:border-brand-border-subtle lg:shadow-cards lg:hover:border-brand-border"
	>
		<div className="size-12 bg-primary-green-200 group-hover:bg-primary-green-300 rounded-xl flex items-center justify-center text-brand-black shrink-0 transition-colors">
			<Icon className="size-6 text-brand-black" aria-hidden="true" />
		</div>
		<div className="flex flex-col lg:gap-1">
			<span className="font-extrabold text-slate-900 text-sm lg:text-body-lg">
				{title}
			</span>
			<span className="text-xs text-slate-500 mt-0.5 lg:text-body">
				{description}
			</span>
		</div>
	</button>
);

export const PathOptionGroup: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => (
	<div className="bg-primary-blue-20/30 border border-primary-blue-50/40 rounded-3xl p-4 flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-5 lg:p-0 lg:bg-transparent lg:border-0">
		{children}
	</div>
);

interface ApplicationStepLayoutProps {
	title: string;
	description: string;
	onBack: () => void;
	backAriaLabel: string;
	children: React.ReactNode;
}

export const ApplicationStepLayout: React.FC<ApplicationStepLayoutProps> = ({
	title,
	description,
	onBack,
	backAriaLabel,
	children,
}) => (
	<PageContainer
		topBarProps={{
			onBack,
			showLanguageSwitcher: true,
			colorVariant: "green",
			backAriaLabel,
			className: "lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pt-4",
		}}
		contentClassName="lg:max-w-[1152px] lg:px-8 xl:px-16 lg:pb-16"
	>
		<div className="flex flex-col gap-6 w-full min-w-0 max-w-md mx-auto text-left pt-4 lg:max-w-180 lg:gap-8 lg:pt-2">
			<div className="flex flex-col gap-2 lg:gap-3">
				<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight lg:text-[2.5rem] lg:leading-12">
					{title}
				</h1>
				<p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line lg:text-body-lg lg:max-w-[60ch]">
					{description}
				</p>
			</div>

			{children}
		</div>
	</PageContainer>
);
