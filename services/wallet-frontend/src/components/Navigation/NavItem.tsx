import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { usePreferencesStore } from "../../store/usePreferencesStore";

interface NavItemProps {
	to?: string;
	onClick?: () => void;
	icon: React.ReactNode;
	label: string;
	isActive?: boolean;
	testId?: string;
	showNotificationDot?: boolean;
}

export const NavItem: React.FC<NavItemProps> = ({
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
		<motion.div
			whileTap={{ scale: 0.9 }}
			className={`
        flex h-full flex-col items-center justify-center gap-1.5 px-4 transition-all
        ${active ? "text-primary-green-500" : "text-white/60 hover:text-white"}
      `}
		>
			<div className="size-7 relative">
				{icon}
				{showNotificationDot && (
					<span
						data-testid="nav-item-notification-dot"
						className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
					>
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
						<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
					</span>
				)}
			</div>
			<span className="text-sm">{label}</span>
		</motion.div>
	);

	if (to) {
		return (
			<NavLink
				to={to}
				onClick={handleInteraction}
				className="h-full"
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
			className="h-full cursor-pointer outline-none"
			data-testid={testId}
		>
			{content(customIsActive ?? false)}
		</button>
	);
};
