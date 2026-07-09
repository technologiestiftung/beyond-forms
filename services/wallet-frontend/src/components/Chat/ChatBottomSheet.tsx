import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useState,
	useRef,
} from "react";
import { useTranslation } from "react-i18next";
import {
	motion,
	AnimatePresence,
	useReducedMotion,
	useDragControls,
} from "framer-motion";
import type { PanInfo } from "framer-motion";
import { useUIStore } from "../../store/useUIStore";
import { useChatStore } from "../../store/useChatStore";
import * as Icons from "../ui/Icons";
import { ChatForm } from "./ChatForm";
import { WelcomeCard } from "./WelcomeCard";
import { ChatMessage } from "./ChatMessage";
import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { ChatErrorMessage } from "./ChatErrorMessage";
import { ChatHistory } from "./ChatHistory";

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
	const messages = useChatStore((s) => s.messages);
	const isLoading = useChatStore((s) => s.isLoading);
	const error = useChatStore((s) => s.error);
	const sendMessage = useChatStore((s) => s.sendMessage);
	const newChat = useChatStore((s) => s.newChat);
	const shouldReduceMotion = useReducedMotion();
	const dragControls = useDragControls();
	const [snap, setSnap] = useState<SheetSnap>("full");
	const [showChatHistory, setShowChatHistory] = useState(false);
	const messagesRef = useRef<HTMLDivElement>(null);

	const submitUserMessage = useCallback(
		(text: string) => {
			void sendMessage(text);
		},
		[sendMessage],
	);

	const handleCloseChat = useCallback(() => {
		setShowChatHistory(false);
		closeChat();
	}, [closeChat]);

	const lastMessageCountRef = useRef(messages.length);

	useLayoutEffect(() => {
		if (showChatHistory) {
			return;
		}
		const el = messagesRef.current;
		if (!el) {
			return;
		}
		const isNewMessage = messages.length > lastMessageCountRef.current;
		lastMessageCountRef.current = messages.length;

		const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;

		if (isNewMessage || isNearBottom) {
			el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
		}
	}, [messages, isLoading, error, showChatHistory]);

	useEffect(() => {
		if (isChatOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isChatOpen]);

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
			{isChatOpen && (
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
						className="fixed w-full max-w-md mx-auto bottom-0 left-0 right-0 bg-white rounded-t-[24px] shadow-[0px_-10px_40px_rgba(0,0,0,0.15)] z-chat-content flex min-h-0 flex-col overflow-hidden xl:left-72 xl:bottom-6 xl:rounded-[24px] xl:max-h-[82vh]"
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

						<div className="flex items-center justify-between px-6 py-3 bg-white rounded-t-[24px] shrink-0">
							<h2 className="text-[20px] font-bold text-brand-black leading-[30px]">
								{showChatHistory ? t("history.title") : t("title")}
							</h2>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => {
										setShowChatHistory(false);
										void newChat();
									}}
									className="size-8 flex items-center justify-center rounded-full bg-transparent hover:bg-brand-bg transition-colors cursor-pointer"
									aria-label={t("new_chat")}
									title={t("new_chat")}
									data-testid="new-chat-button"
								>
									<Icons.PlusIcon className="size-5 text-brand-black" />
								</button>
								<button
									type="button"
									onClick={() => setShowChatHistory((v) => !v)}
									className="size-8 flex items-center justify-center rounded-full bg-transparent hover:bg-brand-bg transition-colors cursor-pointer"
									aria-pressed={showChatHistory}
									aria-label={
										showChatHistory ? t("history.hide") : t("history.show")
									}
									data-testid="chat-history-button"
								>
									<Icons.HistoryIcon className="size-5 text-brand-black" />
								</button>
								<button
									type="button"
									onClick={handleCloseChat}
									className="size-8 flex items-center justify-center rounded-full bg-transparent hover:bg-brand-bg transition-colors cursor-pointer"
									aria-label={t("close")}
								>
									<Icons.XIcon className="size-5 text-brand-black" />
								</button>
							</div>
						</div>

						{showChatHistory ? (
							<ChatHistory closeChatHistory={() => setShowChatHistory(false)} />
						) : (
							<>
								<div
									ref={messagesRef}
									className="min-h-0 flex-1 overflow-y-auto px-5 py-6"
									data-testid="chat-message-list"
								>
									<div className="flex flex-col gap-6">
										<WelcomeCard
											disabled={isLoading}
											onQuickAction={submitUserMessage}
										/>

										{messages.map((msg) => {
											if (
												msg.role === "assistant" &&
												msg.content === "" &&
												isLoading
											) {
												return <ChatTypingIndicator key={msg.id} />;
											}
											if (msg.role === "assistant" && msg.content === "") {
												return null;
											}
											return <ChatMessage key={msg.id} message={msg} />;
										})}

										{error && <ChatErrorMessage />}
									</div>
								</div>
								<ChatForm submitUserMessage={submitUserMessage} />
							</>
						)}
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
};
