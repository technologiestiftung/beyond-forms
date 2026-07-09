import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "../../constants/routes";
import { Upload, Camera } from "lucide-react";

export const DocumentUploadCard = () => {
	const { t } = useTranslation("application");
	const navigate = useNavigate();

	return (
		<div className="bg-brand-border-subtle rounded-xl p-4 flex flex-col gap-3">
			<button
				type="button"
				onClick={() =>
					navigate(`${AppRoutes.ProfilePersonalDataUpload}?origin=wizard`)
				}
				className="w-full bg-white rounded-xl p-4 flex gap-4 shadow-sm transition-all text-left items-start active:scale-95 hover:border-brand-border-subtle border border-transparent"
			>
				<div className="size-12 bg-primary-green-200 rounded-xl flex items-center justify-center shrink-0 text-primary-green-800">
					<Upload className="size-5 text-primary-blue-500" />
				</div>
				<div className="flex flex-col gap-2 flex-1 min-w-0">
					<span className="text-brand-black font-bold text-body-lg">
						{t("docs.actions.upload_title", "Dokument hochladen")}
					</span>
					<span className="text-brand-black font-medium leading-relaxed">
						{t(
							"docs.actions.upload_desc",
							"Lade ein Foto oder PDF Deines Dokuments hoch.",
						)}
					</span>
				</div>
			</button>

			<button
				type="button"
				onClick={() =>
					navigate(
						`${AppRoutes.ProfilePersonalDataUpload}?origin=wizard&mode=camera`,
					)
				}
				className="w-full bg-white rounded-xl p-4 flex gap-4 shadow-sm transition-all text-left items-start active:scale-95 hover:border-brand-border-subtle border border-transparent"
			>
				<div className="size-12 bg-primary-green-200 rounded-xl flex items-center justify-center shrink-0 text-primary-green-800">
					<Camera className="size-5 text-primary-blue-500" />
				</div>
				<div className="flex flex-col gap-2 flex-1 min-w-0">
					<span className="text-brand-black font-bold text-body-lg">
						{t("docs.actions.camera_title", "Mit Kamera scannen")}
					</span>
					<span className="text-brand-black font-medium leading-relaxed">
						{t(
							"docs.actions.camera_desc",
							"Lade ein Foto Deines Dokuments hoch.",
						)}
					</span>
				</div>
			</button>
		</div>
	);
};
