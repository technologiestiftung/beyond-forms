import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, X } from "lucide-react";
import { PrimaryButton } from "../ui/PrimaryButton";
import { EXTERNAL_LINKS } from "../../config/externalLinks";

export interface WelfareOffice {
	name: string;
	street: string;
	zipCity: string;
	hours: string[];
}

export const WELFARE_OFFICES: Record<string, WelfareOffice> = {
	"Charlottenburg-Wilmersdorf": {
		name: "Amt für Soziales Charlottenburg-Wilmersdorf",
		street: "Otto-Suhr-Allee 100",
		zipCity: "10585 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
	"Friedrichshain-Kreuzberg": {
		name: "Amt für Soziales Friedrichshain-Kreuzberg",
		street: "Yorckstraße 4-11",
		zipCity: "10965 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
	Lichtenberg: {
		name: "Amt für Soziales Lichtenberg",
		street: "Alt-Friedrichsfelde 60",
		zipCity: "10315 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
	"Marzahn-Hellersdorf": {
		name: "Amt für Soziales Marzahn-Hellersdorf",
		street: "Riesaer Straße 94",
		zipCity: "12627 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
	Mitte: {
		name: "Amt für Soziales Mitte",
		street: "Müllerstraße 146",
		zipCity: "13353 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
	Neukölln: {
		name: "Amt für Soziales Neukölln",
		street: "Donaustraße 89-90",
		zipCity: "12043 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
	Pankow: {
		name: "Amt für Soziales Pankow",
		street: "Fröbelstraße 17 (Haus 2)",
		zipCity: "10405 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
	Reinickendorf: {
		name: "Amt für Soziales Reinickendorf",
		street: "Eichborndamm 215",
		zipCity: "13437 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
	Spandau: {
		name: "Amt für Soziales Spandau",
		street: "Galenstraße 14",
		zipCity: "13597 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
	"Steglitz-Zehlendorf": {
		name: "Amt für Soziales Steglitz-Zehlendorf",
		street: "Hanna-Renate-Laurien-Platz 1",
		zipCity: "12247 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
	"Tempelhof-Schöneberg": {
		name: "Amt für Soziales Tempelhof-Schöneberg",
		street: "Tempelhofer Damm 165",
		zipCity: "12099 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
	"Treptow-Köpenick": {
		name: "Amt für Soziales Treptow-Köpenick",
		street: "Hans-Schmidt-Straße 16/18",
		zipCity: "12489 Berlin",
		hours: [
			"Dienstag, Donnerstag: 9:00 – 12:00 Uhr",
			"Termine nach Vereinbarung",
		],
	},
};

interface DownloadSuccessModalProps {
	isOpen: boolean;
	onClose: () => void;
	district: string | null;
}

export const DownloadSuccessModal: React.FC<DownloadSuccessModalProps> = ({
	isOpen,
	onClose,
	district,
}) => {
	const { t } = useTranslation("application");

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		if (isOpen) {
			window.addEventListener("keydown", handleKeyDown);
		}
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onClose]);

	if (!isOpen) {
		return null;
	}

	const office = district ? WELFARE_OFFICES[district] : null;

	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-110 flex items-center justify-center p-4 animate-fadeIn">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="success-modal-title"
				className="bg-slate-50 rounded-3xl max-w-md w-full p-6 sm:p-8 flex flex-col gap-6 shadow-2xl border border-slate-100 animate-scaleUp text-left max-h-[90vh] overflow-y-auto"
			>
				<div className="flex items-start justify-between gap-4">
					<div className="w-12 h-12 rounded-2xl bg-primary-green-500/20 flex items-center justify-center text-primary-green-500 shrink-0">
						<CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
					</div>
					<button
						onClick={onClose}
						className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
						aria-label={t("docs.close_aria", "Schließen")}
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				<div>
					<h3
						id="success-modal-title"
						className="text-h2 font-extrabold text-brand-black mb-2 leading-tight"
					>
						{t("overview.success_modal.title", "PDF heruntergeladen!")}
					</h3>
					<p className="text-body-md text-slate-600 leading-relaxed">
						{t(
							"overview.success_modal.subtitle",
							"Dein Antrag liegt auf Deinem Gerät bereit zum Ausdrucken.",
						)}
					</p>
				</div>

				<div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
					<h4 className="text-xs font-bold text-slate-700">
						{t(
							"overview.success_modal.card_title",
							"Was du vor Ort erledigen kannst:",
						)}
					</h4>

					<div className="flex flex-col gap-1.5">
						<h5 className="text-body-sm font-bold text-slate-800">
							{t(
								"overview.success_modal.step1_title",
								"1. Antrag ausdrucken und unterschreiben:",
							)}
						</h5>
						<p className="text-xs text-slate-500 leading-relaxed">
							{t(
								"overview.success_modal.step1_desc",
								"Drucke die heruntergeladene PDF-Datei aus und unterzeichne sie handschriftlich auf der letzten Seite.",
							)}
						</p>
					</div>

					<hr className="border-slate-100" />

					<div className="flex flex-col gap-2">
						<h5 className="text-body-sm font-bold text-slate-800">
							{t(
								"overview.success_modal.step2_title",
								"2. Unterlagen abgeben:",
							)}
						</h5>
						<p className="text-xs text-slate-500 leading-relaxed mb-2">
							{t(
								"overview.success_modal.step2_desc",
								"Du kannst die Unterlagen persönlich bei der Behörde in deiner Nähe abgeben oder per Post senden an:",
							)}
						</p>

						{office ? (
							<div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1.5 text-xs text-slate-700 font-medium">
								<p className="font-bold text-slate-855">{office.name}</p>
								<p>{office.street}</p>
								<p>{office.zipCity}</p>
								<div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-col gap-0.5">
									<p className="text-[10px] font-bold uppercase tracking-wider text-brand-grey">
										{t("overview.success_modal.hours_label", "Öffnungszeiten:")}
									</p>
									{office.hours.map((line, idx) => (
										<p key={idx}>{line}</p>
									))}
								</div>
							</div>
						) : (
							<div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-2 text-xs text-slate-700 font-medium">
								<p className="font-bold text-slate-855">
									{t(
										"overview.success_modal.default_office_name",
										"Zuständiges Sozialamt",
									)}
								</p>
								<p>
									{t(
										"overview.success_modal.default_office_desc",
										"Bitte reiche den Antrag bei dem Sozialamt deines Bezirks ein.",
									)}
								</p>
								<a
									href={EXTERNAL_LINKS.SOZIALAMT}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary-blue-500 hover:underline flex items-center font-bold"
								>
									{t(
										"overview.success_modal.default_office_link",
										"Zuständiges Sozialamt online suchen",
									)}
								</a>
							</div>
						)}
					</div>
				</div>

				<PrimaryButton onClick={onClose} className="w-full mt-2">
					{t(
						"overview.success_modal.cta_button",
						"Zurück zu Antrag auf Grundsicherung",
					)}
				</PrimaryButton>
			</div>
		</div>
	);
};

export default DownloadSuccessModal;
