import React from "react";
import { PageContainer } from "../../components/Layout/PageContainer";

/**
 * Loading placeholder aligned with {@link DashboardView} checklist layout:
 * language area, avatar + title row, intro lines, application card block,
 * two-column tutorial tiles, footer hint line.
 */
export const DashboardSkeleton: React.FC = () => {
	return (
		<PageContainer>
			<div
				className="absolute top-6 right-6 h-9 w-24 rounded-xl bg-slate-200/90"
				aria-hidden
			/>

			<div className="flex flex-col items-start max-w-md w-full min-w-0 gap-6">
				<div className="flex flex-col items-start gap-4 w-full min-w-0">
					<div className="flex flex-row items-center gap-4 w-full min-w-0">
						<div className="size-11 shrink-0 rounded-full bg-white ring-1 ring-slate-200" />
						<div className="h-9 flex-1 max-w-[220px] rounded-lg bg-slate-200/90" />
					</div>
					<div className="h-5 w-full rounded-md bg-slate-200/80" />
					<div className="h-5 w-[88%] rounded-md bg-slate-200/70" />
				</div>

				<div className="w-full rounded-2xl border border-brand-border-subtle bg-white p-6 shadow-sm flex flex-col gap-5 min-h-[200px]">
					<div className="flex flex-row justify-between gap-3 min-w-0">
						<div className="flex flex-col gap-2 flex-1 min-w-0">
							<div className="h-6 w-40 rounded-md bg-slate-200/90" />
							<div className="h-4 w-full rounded-md bg-slate-200/70" />
							<div className="h-4 w-[92%] rounded-md bg-slate-200/60" />
						</div>
						<div className="size-24 shrink-0 rounded-xl bg-slate-100" />
					</div>
					<div className="h-2 w-full rounded-full bg-slate-100" />
					<div className="h-12 w-full rounded-2xl bg-slate-200/50" />
				</div>

				<div className="grid grid-cols-1 xs:grid-cols-2 gap-4 w-full">
					<div className="rounded-2xl bg-primary-blue-500/20 p-5 min-h-[132px] flex flex-col justify-between gap-3 border border-primary-blue-500/10">
						<div className="space-y-2">
							<div className="h-5 w-3/4 rounded-md bg-white/40" />
							<div className="h-3 w-full rounded-md bg-white/30" />
							<div className="h-3 w-2/3 rounded-md bg-white/25" />
						</div>
						<div className="h-6 w-16 rounded-full bg-white/35" />
					</div>
					<div className="rounded-2xl bg-primary-blue-500/20 p-5 min-h-[132px] flex flex-col justify-between gap-3 border border-primary-blue-500/10">
						<div className="space-y-2">
							<div className="h-5 w-2/3 rounded-md bg-white/40" />
							<div className="h-3 w-full rounded-md bg-white/30" />
							<div className="h-3 w-4/5 rounded-md bg-white/25" />
						</div>
						<div className="h-6 w-20 rounded-full bg-white/35" />
					</div>
				</div>

				<div className="flex items-center gap-2 w-full max-w-xs pt-1">
					<div className="h-3 flex-1 rounded-md bg-slate-200/70" />
					<div className="size-3.5 shrink-0 rounded-sm bg-slate-200/70" />
				</div>
			</div>
		</PageContainer>
	);
};
