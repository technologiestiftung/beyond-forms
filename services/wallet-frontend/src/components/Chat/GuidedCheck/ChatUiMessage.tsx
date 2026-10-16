import React from "react";
import { useChatStore } from "../../../store/useChatStore";
import { ChatUiComponent, type ChatUi } from "../../../schemas/chat.schema";
import type { NodeId } from "../../../store/EligibilityEngine";
import type { EligibilityCheck } from "../../../schemas/eligibility.schema";
import { ConsentCard } from "./ConsentCard";
import { QuestionMessage } from "./QuestionMessage";
import { NotedMessage } from "./NotedMessage";
import { ConfirmCard } from "./ConfirmCard";
import { ResultCard } from "./ResultCard";

/** Renders a card in the chat. Only the newest message takes input; older cards show what was answered. */
export const ChatUiMessage: React.FC<{ id: string; ui: ChatUi }> = ({
	id,
	ui,
}) => {
	const isActive = useChatStore(
		(s) => !s.isLoading && s.messages[s.messages.length - 1]?.id === id,
	);

	switch (ui.component) {
		case ChatUiComponent.ELIGIBILITY_CONSENT:
			return <ConsentCard isActive={isActive} />;
		case ChatUiComponent.ELIGIBILITY_QUESTION:
			return (
				<QuestionMessage
					id={id}
					nodeId={ui.props.nodeId as NodeId}
					isActive={isActive}
					answered={ui.props.answered === true}
				/>
			);
		case ChatUiComponent.ELIGIBILITY_NOTED:
			return <NotedMessage field={ui.props.field as keyof EligibilityCheck} />;
		case ChatUiComponent.ELIGIBILITY_CONFIRM:
			return <ConfirmCard isActive={isActive} />;
		default:
			return <ResultCard />;
	}
};
