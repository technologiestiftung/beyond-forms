import React from "react";
import { useTranslation } from "react-i18next";
import type { EligibilityCheck } from "../../../schemas/eligibility.schema";
import { useChatStore } from "../../../store/useChatStore";
import { useEligibilityStore } from "../../../store/useEligibilityStore";
import { useGuidedCheckStore } from "../../../store/useGuidedCheckStore";
import { provisionalFieldsOnPath } from "../../../store/guidedCheck";
import { ChatCard, ChipButton } from "./ChatCard";
import { useAnswerLabel } from "./useAnswerLabel";

export const ConfirmCard: React.FC<{ isActive: boolean }> = ({ isActive }) => {
	const { t } = useTranslation("chat");
	const answers = useEligibilityStore((s) => s.answers);
	const clearAnswer = useEligibilityStore((s) => s.clearAnswer);
	const clearProvisional = useGuidedCheckStore((s) => s.clearProvisional);
	const showNextGuidedStep = useChatStore((s) => s.showNextGuidedStep);
	const { fieldLabel, answerLabel } = useAnswerLabel();
	const fields = provisionalFieldsOnPath();

	const confirm = () => {
		clearProvisional();
		showNextGuidedStep();
	};

	const answerOneByOne = () => {
		fields.forEach(clearAnswer);
		clearProvisional();
		showNextGuidedStep();
	};

	return (
		<ChatCard testId="guided-confirm-card">
			<div className="flex flex-col gap-1">
				<h3 className="text-[16px] font-bold text-brand-black">
					{t("guided.confirm.title")}
				</h3>
				<p className="text-[14px] text-brand-grey">
					{t("guided.confirm.description")}
				</p>
			</div>
			{isActive && (
				<>
					<dl className="flex flex-col gap-2 text-[14px]">
						{fields.map((field) => (
							<div key={field} className="flex justify-between gap-4">
								<dt className="text-brand-grey">{fieldLabel(field)}</dt>
								<dd className="font-semibold text-right">
									{answerLabel(
										field,
										answers[field] as EligibilityCheck[typeof field],
									)}
								</dd>
							</div>
						))}
					</dl>
					<div className="flex flex-wrap gap-2">
						<ChipButton variant="solid" onClick={confirm}>
							{t("guided.confirm.ok")}
						</ChipButton>
						<ChipButton onClick={answerOneByOne}>
							{t("guided.confirm.change")}
						</ChipButton>
					</div>
				</>
			)}
		</ChatCard>
	);
};
