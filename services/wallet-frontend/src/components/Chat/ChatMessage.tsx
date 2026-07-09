import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage as ChatMessageType } from "../../store/useChatStore";

export const ChatMessage: React.FC<{ message: ChatMessageType }> = ({
	message,
}) => {
	const { role, id, content } = message;
	return (
		<div data-role={role} data-message-id={id} className="w-full">
			{role === "assistant" && <AssistantMessage content={content} />}

			{role === "user" && <UserMessage content={content} />}
		</div>
	);
};

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
