import React from "react";
import { useTranslation } from "react-i18next";
import { useEligibilityStore } from "../../../store/useEligibilityStore";
import type { EligibilityCheck } from "../../../schemas/eligibility.schema";
import { useAnswerLabel } from "./useAnswerLabel";

export const NotedMessage: React.FC<{ field: keyof EligibilityCheck }> = ({
	field,
}) => {
	const { t } = useTranslation("chat");
	const value = useEligibilityStore((s) => s.answers[field]);
	const { fieldLabel, answerLabel } = useAnswerLabel();

	if (value === undefined) {
		return null;
	}
	return (
		<p
			data-testid="guided-noted"
			className="w-fit rounded-full bg-primary-green-200 px-3 py-1 text-[13px] text-primary-blue-500"
		>
			{t("guided.noted", {
				label: fieldLabel(field),
				value: answerLabel(field, value),
			})}
		</p>
	);
};
