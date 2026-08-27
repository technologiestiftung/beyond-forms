import { useState } from "react";
import { useTranslation } from "react-i18next";
import { env } from "../config/env.config";
import { authenticatedFetch } from "../utils/apiClient";

/**
 * Generates a filled application PDF for a given form type and returns a URL that
 * can be opened or downloaded. Mirrors the mock/real branching already used by the
 * Grundsicherung wizard's PDF export (see ApplicationOverview.tsx), so simplified
 * application types without a wizard can reuse the same behavior.
 */
export function useGenerateApplication(formType: string) {
	const { t } = useTranslation("dashboard");
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const generate = async (): Promise<string | null> => {
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
				return URL.createObjectURL(blob);
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
				return data.signed_open_url as string;
			}
			const blob = await response.blob();
			return URL.createObjectURL(blob);
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
