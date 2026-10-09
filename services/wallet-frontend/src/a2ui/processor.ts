import { MessageProcessor, type ActionListener } from "@a2ui/web_core/v0_9";
import type { ReactComponentImplementation } from "@a2ui/react/v0_9";
import { klaroCatalog } from "./catalog";
import type { A2uiMessage } from "./messages";

let actionListener: ActionListener = () => undefined;

/** Routes user actions from every surface in the chat, see `setA2uiActionListener`. */
export const a2uiProcessor = new MessageProcessor<ReactComponentImplementation>(
	[klaroCatalog],
	(action) => actionListener(action),
);

export const setA2uiActionListener = (listener: ActionListener) => {
	actionListener = listener;
};

export const processA2uiMessages = (messages: A2uiMessage[]) =>
	a2uiProcessor.processMessages(messages as never);
