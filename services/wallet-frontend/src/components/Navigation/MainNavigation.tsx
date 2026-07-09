import React, { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { AppRoutes } from "../../constants/routes";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store/useUIStore";
import * as Icons from "../ui/Icons";
import { MOBILE_BAR_PX, NavBarShape } from "./NavBarShape";
import { ChatButton } from "./ChatButton";
import { NavItem } from "./NavItem";
import { useProfile } from "../../hooks/useProfile";

const MOBILE_FAB_TOP_OFFSET_PX = 28;

export const MainNavigation: React.FC = () => {
	const { t } = useTranslation();
	const { toggleChat, isChatOpen } = useUIStore();
	const location = useLocation();
	const { documents } = useProfile();

	const hasNotifications = (documents || []).some(
		(doc) => doc.status === "READY_FOR_REVIEW",
	);
	const dashboardPath = AppRoutes.Dashboard;
	const profilePath = AppRoutes.Profile;
	const dashboardActive =
		location.pathname.startsWith(AppRoutes.Dashboard) ||
		location.pathname === AppRoutes.Home;
	const profileActive = location.pathname.startsWith(AppRoutes.Profile);

	const handleChatButton = useCallback(() => {
		toggleChat();
	}, [toggleChat]);

	const dashboardLabel = t("common:nav.dashboard");
	const profileLabel = t("common:nav.my_account");
	const chatLabel = t("common:nav.chat");

	return (
		<nav
			className="
      fixed bottom-0 left-0 z-50 w-full
      bg-transparent safe-area-bottom
      lg:left-0 lg:top-0 lg:bottom-auto lg:flex lg:h-screen lg:w-72 lg:translate-x-0
      lg:flex-col lg:justify-start lg:bg-primary-blue-500 lg:px-4 lg:pt-12
      lg:border-r lg:border-white/5 lg:border-t-0 lg:pb-0
    "
			aria-label={t("nav.mainNavigation", "Main navigation")}
		>
			<div
				className="relative mx-auto w-full max-w-md lg:hidden"
				style={{
					paddingTop: MOBILE_FAB_TOP_OFFSET_PX,
					minHeight: MOBILE_FAB_TOP_OFFSET_PX + MOBILE_BAR_PX,
				}}
			>
				<NavBarShape />
				<ChatButton
					onClick={handleChatButton}
					active={isChatOpen}
					label={chatLabel}
				/>
				<div
					className="relative z-10 grid w-full grid-cols-3 items-end px-5"
					style={{ height: MOBILE_BAR_PX }}
				>
					<NavItem
						to={dashboardPath}
						testId="applications-link"
						icon={<Icons.LayersIcon className="size-full" />}
						label={dashboardLabel}
						isActive={dashboardActive}
						showNotificationDot={hasNotifications}
					/>
					<span aria-hidden className="pointer-events-none" />
					<NavItem
						to={profilePath}
						testId="profile-link"
						icon={<Icons.UserIcon className="size-full" />}
						label={profileLabel}
						isActive={profileActive}
					/>
				</div>
			</div>

			<div className="hidden h-full w-full flex-col lg:flex">
				<div className="mb-12 flex w-full items-center gap-3 px-6">
					<div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-lg shadow-white/5">
						<Icons.StepIcon1 className="size-6 text-brand-black" />
					</div>
					<h1 className="text-2xl font-bold tracking-tight text-white">
						Klaro
					</h1>
				</div>

				<div className="flex flex-col gap-4 items-center justify-start">
					<NavItem
						to={dashboardPath}
						testId="applications-link"
						icon={<Icons.WalletIcon className="size-full" />}
						label={dashboardLabel}
						isActive={dashboardActive}
						showNotificationDot={hasNotifications}
					/>
					<NavItem
						to={profilePath}
						testId="profile-link"
						icon={<Icons.UserIcon className="size-full" />}
						label={profileLabel}
						isActive={profileActive}
					/>
					<NavItem
						onClick={toggleChat}
						icon={<Icons.ChatIcon className="size-full" />}
						label={chatLabel}
						isActive={isChatOpen}
						testId="nav-chat-sidebar"
					/>
				</div>
			</div>
		</nav>
	);
};
