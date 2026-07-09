import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { MainNavigation } from "../Navigation/MainNavigation";
import { ChatBottomSheet } from "../../components/Chat/ChatBottomSheet";
import { getRouteMetadata } from "../../config/routeConfig";
import { useAuthStore } from "../../store/useAuthStore";
import { useUIStore } from "../../store/useUIStore";

export const AppShell: React.FC = () => {
	const location = useLocation();
	const metadata = getRouteMetadata(location.pathname);
	const isAuthenticated = !!useAuthStore((s) => s.token);
	const isStepLayout = metadata?.layout === "step";
	const isHome = location.pathname === "/";
	const { isChatOpen } = useUIStore();

	const showNav =
		isAuthenticated &&
		!isChatOpen &&
		(metadata?.showNav || !isStepLayout || isHome);

	return (
		<div className="flex h-screen w-full bg-brand-bg font-sans overflow-x-hidden">
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-200 focus:bg-white focus:p-4 focus:rounded-lg focus:shadow-xl focus:text-brand-primary focus:font-bold"
			>
				Skip to main content
			</a>
			{showNav && <MainNavigation />}

			<main
				id="main-content"
				// For "lg" if nav is shown, width is screen width minus w-72 (width of nav).
				className={`
					flex-1 flex flex-col items-center justify-start w-full h-screen transition-all
					overflow-x-hidden overflow-y-auto
					${showNav ? "lg:max-w-[calc(100vw-(var(--spacing)*72))] lg:ml-72" : ""}
					`}
			>
				<Outlet />
			</main>

			<ChatBottomSheet />
		</div>
	);
};
