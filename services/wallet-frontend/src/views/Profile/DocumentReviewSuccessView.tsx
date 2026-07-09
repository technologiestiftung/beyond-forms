import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Check } from "lucide-react";
import { PageContainer } from "../../components/Layout/PageContainer";
import { getTargetExitRoute } from "../../utils/profile";
import { PrimaryButton } from "../../components/ui/PrimaryButton";

export const DocumentReviewSuccessView: React.FC = () => {
	const { t } = useTranslation("profile");
	const navigate = useNavigate();
	const location = useLocation();
	const searchParams = new URLSearchParams(location.search);
	const origin = searchParams.get("origin") || "hub";
	const category = searchParams.get("category");

	return (
		<PageContainer topBarProps={{ showLanguageSwitcher: true }}>
			<div className="w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300 pt-8">
				{/* High Premium Green Status Mark Circle Banner */}
				<div className="size-24 bg-primary-green-500 rounded-full flex items-center justify-center text-primary-blue-500 shadow-md mb-6 animate-bounce duration-1000">
					<CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
				</div>

				{/* Core Headlines */}
				<h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
					{t("success.headline", "Daten übernommen")}
				</h1>

				<p className="text-sm text-brand-grey max-w-xs mb-8 leading-relaxed">
					{t(
						"success.subtext",
						"Deine Angaben wurden erfolgreich analysiert, validiert und in Deine Akte übertragen.",
					)}
				</p>

				{/* Milestone Overview Item Card Deck */}
				<div className="w-full bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-left flex flex-col gap-4 mb-10">
					<h4 className="text-[10px] font-bold text-brand-grey uppercase tracking-wider mb-1 px-0.5">
						{t("success.summary_title", "Was wurde gespeichert?")}
					</h4>

					<MilestoneRow
						text={t("success.milestone.imported", "Daten übernommen")}
					/>
					<MilestoneRow
						text={t("success.milestone.saved", "Dokument gespeichert")}
					/>
					<MilestoneRow
						text={t("success.milestone.updated", "Antrag aktualisiert")}
					/>
				</div>

				{/* Return Target Action Trigger Button */}
				<PrimaryButton
					onClick={() => {
						navigate(getTargetExitRoute(origin, category, "review_success"));
					}}
				>
					{t("success.back_action", "Weiter")}
				</PrimaryButton>
			</div>
		</PageContainer>
	);
};

const MilestoneRow: React.FC<{ text: string }> = ({ text }) => (
	<div className="flex items-center space-x-3.5 animate-in slide-in-from-left-2 duration-300">
		<div className="size-5 rounded-full bg-primary-blue-500 flex items-center justify-center text-white shadow-sm shrink-0">
			<Check className="w-3 h-3 stroke-[3]" />
		</div>
		<span className="text-sm font-bold text-slate-700">{text}</span>
	</div>
);
