import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage as ChatMessageType } from "../../store/useChatStore";
import { ChatUiMessage } from "./GuidedCheck/ChatUiMessage";

export const ChatMessage: React.FC<{ message: ChatMessageType }> = ({
	message,
}) => (
	<div
		data-role={message.role}
		data-message-id={message.id}
		className="w-full empty:hidden"
	>
		{message.role === "assistant" && (
			<AssistantMessage content={message.content} />
		)}

		{message.role === "user" && <UserMessage content={message.content} />}

		{message.role === "ui" && <ChatUiMessage id={message.id} ui={message} />}
	</div>
);

const sanitizePronouns = (text: string): string =>
	text.replace(/\*\*(Du|Dein|Dir|Dich|Ihnen|Ihr|you|your)\*\*/gi, "$1");

const AssistantMessage: React.FC<{ content: string }> = ({ content }) => (
	<div className="flex items-start w-full">
		<div className="bg-brand-bg rounded-xl px-4 py-3 max-w-[85%]">
			<div className="markdown-container">
				<ReactMarkdown remarkPlugins={[remarkGfm]}>
					{sanitizePronouns(content)}
				</ReactMarkdown>
			</div>
		</div>
	</div>
);

const UserMessage: React.FC<{ content: string }> = ({ content }) => (
	<div className="flex items-start justify-end w-full">
		<div className="bg-primary-blue-500 rounded-xl px-4 py-3 max-w-[85%]">
			<div className="markdown-container markdown-container--user">
				<ReactMarkdown remarkPlugins={[remarkGfm]}>
					{sanitizePronouns(content)}
				</ReactMarkdown>
			</div>
		</div>
	</div>
);
