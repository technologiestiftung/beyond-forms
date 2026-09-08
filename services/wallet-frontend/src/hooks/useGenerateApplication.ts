import { useState } from "react";
import { useTranslation } from "react-i18next";
import { env } from "../config/env.config";
import { authenticatedFetch } from "../utils/apiClient";

export interface GeneratedApplication {
	openUrl: string;
	downloadUrl: string;
	filename: string;
	expiresInSeconds: number;
}

/**
 * Generates a filled application PDF for a given form type and returns the signed
 * URL pair (inline preview + forced download) a PdfPreviewModal needs.
 */
export function useGenerateApplication(formType: string) {
	const { t } = useTranslation("dashboard");
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const generate = async (): Promise<GeneratedApplication | null> => {
		setIsGenerating(true);
		setError(null);
		try {
			if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
				const { MOCK_PDF_BASE64 } = await import(
					"../views/Application/mockPdf"
				);
				const binaryString = window.atob(MOCK_PDF_BASE64);
				const bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}
				const blob = new Blob([bytes], { type: "application/pdf" });
				const url = URL.createObjectURL(blob);
				return {
					openUrl: url,
					downloadUrl: url,
					filename: `${formType}.pdf`,
					expiresInSeconds: 60,
				};
			}

			const response = await authenticatedFetch(
				`${env.VITE_API_URL}/export/${formType}`,
			);
			if (!response.ok) {
				throw new Error(`Failed to generate PDF: ${response.statusText}`);
			}
			const contentType = response.headers.get("content-type") || "";
			if (contentType.includes("application/json")) {
				const data = await response.json();
				return {
					openUrl: data.signed_open_url as string,
					downloadUrl: data.signed_download_url as string,
					filename: (data.filename as string) || `${formType}.pdf`,
					expiresInSeconds: (data.expires_in_seconds as number) || 60,
				};
			}
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			return {
				openUrl: url,
				downloadUrl: url,
				filename: `${formType}.pdf`,
				expiresInSeconds: 60,
			};
		} catch (err) {
			console.error(`Failed to generate ${formType}:`, err);
			setError(
				t(
					"sections.applications.generate_error",
					"Konnte den Antrag nicht generieren. Bitte versuche es später noch einmal.",
				),
			);
			return null;
		} finally {
			setIsGenerating(false);
		}
	};

	return { generate, isGenerating, error };
}
