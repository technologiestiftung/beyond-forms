import React, { useCallback } from "react";
import { NavLink } from "react-router-dom";
import { usePreferencesStore } from "../../store/usePreferencesStore";

interface SidebarNavItemProps {
	to?: string;
	onClick?: () => void;
	icon: React.ReactNode;
	label: string;
	isActive?: boolean;
	testId?: string;
	showNotificationDot?: boolean;
}

export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
	to,
	onClick,
	icon,
	label,
	isActive: customIsActive,
	testId,
	showNotificationDot,
}) => {
	const setLastSelectedNav = usePreferencesStore((s) => s.setLastSelectedNav);

	const handleInteraction = useCallback(() => {
		if (to) {
			setLastSelectedNav(to);
		}
		onClick?.();
	}, [setLastSelectedNav, to, onClick]);

	const content = (active: boolean) => (
		<span
			className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-primary-blue-300 hover:text-white ${
				active
					? "font-bold text-primary-green-500"
					: "font-medium text-white/85"
			}`}
		>
			<span className="relative size-6 shrink-0">
				{icon}
				{showNotificationDot && (
					<span
						data-testid="nav-item-notification-dot"
						className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
					>
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
						<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
					</span>
				)}
			</span>
			<span className="min-w-0 truncate text-base">{label}</span>
		</span>
	);

	if (to) {
		return (
			<NavLink
				to={to}
				onClick={handleInteraction}
				className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-green-500 rounded-xl"
				data-testid={testId}
			>
				{({ isActive }) => content(customIsActive ?? isActive)}
			</NavLink>
		);
	}

	return (
		<button
			type="button"
			onClick={handleInteraction}
			className="w-full cursor-pointer rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-green-500"
			data-testid={testId}
		>
			{content(customIsActive ?? false)}
		</button>
	);
};
