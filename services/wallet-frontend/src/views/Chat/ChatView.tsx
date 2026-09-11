import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChatPanel } from "../../components/Chat/ChatPanel";
import { AppRoutes } from "../../constants/routes";
import { useIsDesktop } from "../../hooks/useIsDesktop";
import { useUIStore } from "../../store/useUIStore";

/**
 * The chat as a page next to the sidebar. Mobile has no chat page: it opens the
 * bottom sheet over the dashboard instead.
 */
export const ChatView: React.FC = () => {
	const navigate = useNavigate();
	const isDesktop = useIsDesktop();
	const openChat = useUIStore((s) => s.openChat);

	useEffect(() => {
		if (!isDesktop) {
			openChat();
			navigate(AppRoutes.Dashboard, { replace: true });
		}
	}, [isDesktop, openChat, navigate]);

	if (!isDesktop) {
		return null;
	}

	return (
		<div className="w-full max-w-[1152px] h-full min-h-0 flex flex-col px-8 xl:px-16 py-6">
			<ChatPanel
				onClose={() => navigate(AppRoutes.Dashboard)}
				className="bg-white rounded-2xl border border-brand-border-subtle shadow-cards overflow-hidden"
			/>
		</div>
	);
};
