import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../store/useChatStore";
import * as Icons from "../ui/Icons";
import { ChatForm } from "./ChatForm";
import { WelcomeCard } from "./WelcomeCard";
import { ChatMessage } from "./ChatMessage";
import { ChatCard } from "./ChatCard";
import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { ChatErrorMessage } from "./ChatErrorMessage";
import { ChatHistory } from "./ChatHistory";
import { useIsDesktop } from "../../hooks/useIsDesktop";

interface ChatPanelProps {
	onClose: () => void;
	className?: string;
}

/**
 * The chat itself: header, conversation and composer. It is wrapped by the
 * mobile bottom sheet and rendered inline in the content area on desktop.
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({
	onClose,
	className = "",
}) => {
	const { t } = useTranslation("chat");
	const isDesktop = useIsDesktop();
	const messages = useChatStore((s) => s.messages);
	const isLoading = useChatStore((s) => s.isLoading);
	const error = useChatStore((s) => s.error);
	const sendMessage = useChatStore((s) => s.sendMessage);
	const answerCard = useChatStore((s) => s.answerCard);
	const newChat = useChatStore((s) => s.newChat);
	// The desktop side panel starts open; the mobile sheet has no room for it.
	const [showChatHistory, setShowChatHistory] = useState(isDesktop);
	const messagesRef = useRef<HTMLDivElement>(null);
	// Follows the conversation as it streams until the user scrolls up.
	const followRef = useRef(true);

	const submitUserMessage = useCallback(
		(text: string) => {
			void sendMessage(text);
		},
		[sendMessage],
	);

	// Desktop keeps the conversation in view and opens history beside it.
	const showsSideHistory = isDesktop && showChatHistory;
	const showsInlineHistory = !isDesktop && showChatHistory;

	useLayoutEffect(() => {
		// Sending a message or answering a card jumps back to the bottom.
		if (isLoading) {
			followRef.current = true;
		}
	}, [isLoading]);

	useLayoutEffect(() => {
		const el = messagesRef.current;
		if (el && followRef.current) {
			el.scrollTop = el.scrollHeight;
		}
	}, [messages, isLoading, error, showsInlineHistory]);

	return (
		<div data-testid="chat-panel" className="flex min-h-0 flex-1 gap-5">
			<div className={`flex min-h-0 flex-1 flex-col ${className}`}>
				<div className="flex items-center justify-between px-6 py-3 shrink-0">
					<h2 className="text-[20px] font-bold text-brand-black leading-[30px]">
						{showsInlineHistory ? t("history.title") : t("title")}
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
							onClick={() => {
								setShowChatHistory(false);
								onClose();
							}}
							className="size-8 flex items-center justify-center rounded-full bg-transparent hover:bg-brand-bg transition-colors cursor-pointer"
							aria-label={t("close")}
						>
							<Icons.XIcon className="size-5 text-brand-black" />
						</button>
					</div>
				</div>

				{showsInlineHistory ? (
					<ChatHistory closeChatHistory={() => setShowChatHistory(false)} />
				) : (
					<>
						<div
							ref={messagesRef}
							onScroll={(e) => {
								const el = e.currentTarget;
								followRef.current =
									el.scrollHeight - el.scrollTop - el.clientHeight < 32;
							}}
							className="min-h-0 flex-1 overflow-y-auto px-5 py-6"
							data-testid="chat-message-list"
						>
							<div className="flex flex-col gap-6">
								<WelcomeCard
									disabled={isLoading}
									onQuickAction={submitUserMessage}
								/>

								{messages.map((msg) => {
									if (msg.role === "card") {
										return (
											<ChatCard
												key={msg.id}
												message={msg}
												disabled={isLoading}
												onSubmit={(values) =>
													void answerCard(msg.toolCallId, values)
												}
											/>
										);
									}
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
			</div>

			{showsSideHistory && (
				<aside
					data-testid="chat-history-panel"
					aria-label={t("history.title")}
					className="flex w-[320px] shrink-0 min-h-0 flex-col overflow-hidden rounded-2xl border border-brand-border-subtle bg-white shadow-cards"
				>
					<div className="flex items-center justify-between px-6 py-3 shrink-0">
						<h2 className="text-[20px] font-bold text-brand-black leading-[30px]">
							{t("history.title")}
						</h2>
						<button
							type="button"
							onClick={() => setShowChatHistory(false)}
							className="size-8 flex items-center justify-center rounded-full bg-transparent hover:bg-brand-bg transition-colors cursor-pointer"
							aria-label={t("history.hide")}
						>
							<Icons.XIcon className="size-5 text-brand-black" />
						</button>
					</div>

					<ChatHistory
						closeChatHistory={() => setShowChatHistory(false)}
						showBackToChat={false}
					/>
				</aside>
			)}
		</div>
	);
};
