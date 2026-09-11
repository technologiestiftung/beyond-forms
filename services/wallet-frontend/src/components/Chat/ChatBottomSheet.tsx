import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	motion,
	AnimatePresence,
	useReducedMotion,
	useDragControls,
} from "framer-motion";
import type { PanInfo } from "framer-motion";
import { useUIStore } from "../../store/useUIStore";
import { useIsDesktop } from "../../hooks/useIsDesktop";
import { ChatPanel } from "./ChatPanel";

type SheetSnap = "half" | "full";

const SNAP_HEIGHTS: Record<SheetSnap, string> = {
	half: "60svh",
	full: "95svh",
};

const DRAG_CLOSE_THRESHOLD = 80;
const DRAG_EXPAND_THRESHOLD = -60;
const VELOCITY_THRESHOLD = 300;

export const ChatBottomSheet: React.FC = () => {
	const { t } = useTranslation("chat");
	const { isChatOpen, closeChat } = useUIStore();
	const isDesktop = useIsDesktop();
	const shouldReduceMotion = useReducedMotion();
	const dragControls = useDragControls();
	const [snap, setSnap] = useState<SheetSnap>("full");

	// Desktop renders the chat inline in the content area instead of a sheet.
	const isSheetOpen = isChatOpen && !isDesktop;

	const handleCloseChat = useCallback(() => {
		closeChat();
	}, [closeChat]);

	useEffect(() => {
		if (isSheetOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isSheetOpen]);

	const handleDragEnd = (
		_: MouseEvent | TouchEvent | PointerEvent,
		info: PanInfo,
	) => {
		const { offset, velocity } = info;

		if (offset.y > DRAG_CLOSE_THRESHOLD || velocity.y > VELOCITY_THRESHOLD) {
			if (snap === "full") {
				setSnap("half");
			} else {
				handleCloseChat();
			}
			return;
		}

		if (offset.y < DRAG_EXPAND_THRESHOLD || velocity.y < -VELOCITY_THRESHOLD) {
			setSnap("full");
		}
	};

	return (
		<AnimatePresence>
			{isSheetOpen && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						onClick={handleCloseChat}
						className="fixed inset-0 bg-brand-black/40 backdrop-blur-sm z-chat-backdrop"
						aria-hidden="true"
					/>

					<motion.div
						initial={{
							y: shouldReduceMotion ? 0 : "100%",
							opacity: shouldReduceMotion ? 0 : 1,
							height: SNAP_HEIGHTS[snap],
						}}
						animate={{ y: 0, opacity: 1, height: SNAP_HEIGHTS[snap] }}
						exit={{
							y: shouldReduceMotion ? 0 : "100%",
							opacity: shouldReduceMotion ? 0 : 1,
							height: SNAP_HEIGHTS[snap],
						}}
						transition={{ type: "spring", damping: 44, stiffness: 340 }}
						drag="y"
						dragControls={dragControls}
						dragListener={false}
						dragConstraints={{ top: 0, bottom: 0 }}
						dragElastic={0.15}
						onDragEnd={handleDragEnd}
						className="fixed w-full max-w-md mx-auto bottom-0 left-0 right-0 bg-white rounded-t-[24px] shadow-[0px_-10px_40px_rgba(0,0,0,0.15)] z-chat-content flex min-h-0 flex-col overflow-hidden"
						role="dialog"
						aria-modal="true"
						aria-label={t("title")}
					>
						<div
							onPointerDown={(e) => dragControls.start(e)}
							className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing shrink-0"
						>
							<div className="w-10 h-1 bg-brand-border-subtle rounded-full" />
						</div>

						<ChatPanel
							onClose={handleCloseChat}
							className="rounded-t-[24px] bg-white"
						/>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
};
