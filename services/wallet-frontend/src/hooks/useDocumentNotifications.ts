import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Profile, WalletDocument } from "../schemas/profile.schema";

/**
 * Custom hook to simulate or handle real-time document processing notifications.
 */
export function useDocumentNotifications() {
	const queryClient = useQueryClient();

	useEffect(() => {
		// Only enable simulation in dev mode or if explicitly requested in tests
		const isTest = import.meta.env.MODE === "test";
		const forceSim =
			typeof window !== "undefined" &&
			window.sessionStorage.getItem("beyond-forms-test-config-sim") === "true";

		if (isTest && !forceSim) {
			return undefined;
		}

		const interval = setInterval(() => {
			const profile = queryClient.getQueryData<Profile>(["profile"]);
			if (!profile || !profile.documents) {
				return;
			}

			const hasProcessing = profile.documents.some(
				(d) => d.status === "PROCESSING",
			);
			if (hasProcessing) {
				const updatedDocuments = profile.documents.map((doc) => {
					if (doc.status === "PROCESSING") {
						return {
							...doc,
							status: "COMPLETED",
							confidence: 0.85 + Math.random() * 0.1,
						} as WalletDocument;
					}
					return doc;
				});

				queryClient.setQueryData(["profile"], {
					...profile,
					documents: updatedDocuments,
				});
			}
		}, 2000); // Faster for UX/Test

		return () => {
			clearInterval(interval);
		};
	}, [queryClient]);
}
