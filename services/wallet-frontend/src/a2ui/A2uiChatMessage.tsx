import React from "react";
import { A2uiSurface } from "@a2ui/react/v0_9";
import { a2uiProcessor, processA2uiMessages } from "./processor";
import type { A2uiMessage } from "./messages";

/** Renders one A2UI surface in the chat, replaying its messages after a page reload. */
export const A2uiChatMessage: React.FC<{
	surfaceId: string;
	messages: A2uiMessage[];
}> = ({ surfaceId, messages }) => {
	if (!a2uiProcessor.getSurface(surfaceId)) {
		processA2uiMessages(messages);
	}
	const surface = a2uiProcessor.getSurface(surfaceId);
	return surface ? <A2uiSurface surface={surface} /> : null;
};
