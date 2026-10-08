import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../../store/useChatStore";
import { startGuidedCheck } from "../../../store/guidedCheck";
import { ChatCard, ChipButton } from "./ChatCard";

export const ConsentCard: React.FC<{ isActive: boolean }> = ({ isActive }) => {
	const { t } = useTranslation("chat");
	const showNextGuidedStep = useChatStore((s) => s.showNextGuidedStep);
	const [declined, setDeclined] = useState(false);

	const start = () => {
		startGuidedCheck();
		showNextGuidedStep();
	};

	return (
		<ChatCard testId="guided-consent-card">
			<h3 className="text-[16px] font-bold text-brand-black">
				{t("guided.consent.title")}
			</h3>
			<dl className="flex flex-col gap-2 text-[14px] leading-[22px]">
				<div>
					<dt className="font-semibold">{t("guided.consent.goal_label")}</dt>
					<dd>{t("guided.consent.goal")}</dd>
				</div>
				<div>
					<dt className="font-semibold">{t("guided.consent.scope_label")}</dt>
					<dd>{t("guided.consent.scope")}</dd>
				</div>
				<div>
					<dt className="font-semibold">{t("guided.consent.privacy_label")}</dt>
					<dd>{t("guided.consent.privacy")}</dd>
				</div>
			</dl>
			{isActive && !declined && (
				<div className="flex flex-wrap gap-2">
					<ChipButton variant="solid" onClick={start}>
						{t("guided.consent.start")}
					</ChipButton>
					<ChipButton onClick={() => setDeclined(true)}>
						{t("guided.consent.later")}
					</ChipButton>
				</div>
			)}
		</ChatCard>
	);
};
