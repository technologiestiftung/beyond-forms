import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "./useProfile";
import { authenticatedFetch } from "../utils/apiClient";
import { env } from "../config/env.config";
import { profileService } from "../services/profile";
import type { WalletDocument } from "../schemas/profile.schema";
import { performMockAutoVerification } from "../utils/profile";

export const useAutoVerification = (targetTypes?: string[]) => {
	const queryClient = useQueryClient();
	const { documents } = useProfile();
	const [autoVerifying, setAutoVerifying] = useState(false);

	// Serialize array to prevent reference-triggering useEffect loop
	const targetTypesKey = targetTypes ? targetTypes.join(",") : "";

	const processMockDoc = async (docId: string) => {
		try {
			const profileObj = await profileService.getProfile();
			if (!profileObj) {
				return false;
			}
			const docs: WalletDocument[] = profileObj.documents || [];
			const docToUpdate = docs.find((d) => d.id === docId);
			if (!docToUpdate) {
				return false;
			}

			docToUpdate.status = "VERIFIED";
			docToUpdate.updatedAt = new Date().toISOString();

			const { updatedProfile, hasChanges: wasUpdated } =
				performMockAutoVerification(profileObj, docToUpdate);

			if (wasUpdated) {
				await profileService.updateProfileSection("documents", docs);
				if (updatedProfile.personalData) {
					await profileService.updateProfileSection(
						"personalData",
						updatedProfile.personalData,
					);
				}
				if (updatedProfile.financial) {
					await profileService.updateProfileSection(
						"financial",
						updatedProfile.financial,
					);
				}
				if (updatedProfile.address) {
					await profileService.updateProfileSection(
						"address",
						updatedProfile.address,
					);
				}
				return true;
			}
		} catch (mockErr) {
			console.error(`Mock auto-verification failed for ${docId}:`, mockErr);
		}
		return false;
	};

	useEffect(() => {
		let active = true;

		const runAutoVerify = async () => {
			const pendingDocs = (documents || []).filter((doc) => {
				const isTarget =
					!targetTypesKey ||
					targetTypesKey.split(",").includes((doc.type || "").toLowerCase());
				const isReady = doc.status === "READY_FOR_REVIEW";
				const blacklistKey = doc.id ? `failed_autoverify_${doc.id}` : "";
				const isBlacklisted =
					!!blacklistKey && sessionStorage.getItem(blacklistKey) === "true";
				return isTarget && isReady && !isBlacklisted;
			});

			if (pendingDocs.length === 0) {
				setAutoVerifying(false);
				return;
			}

			setAutoVerifying(true);
			let hasChanges = false;

			for (const doc of pendingDocs) {
				const docId = doc.id;
				const blacklistKey = `failed_autoverify_${docId}`;
				if (sessionStorage.getItem(blacklistKey) === "true") {
					continue;
				}

				if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
					const mockChanged = await processMockDoc(docId);
					if (mockChanged) {
						hasChanges = true;
					}
					continue;
				}

				try {
					const extResp = await authenticatedFetch(
						`${env.VITE_API_URL}/api/v1/documents/${docId}/extractions`,
					);
					if (!extResp.ok) {
						throw new Error("Failed to fetch extractions");
					}
					if (!active) {
						return;
					}

					const extData = await extResp.json();
					const rawData = extData.raw_data || {};
					const docType = extData.document_type || doc.type;

					const verifyResp = await authenticatedFetch(
						`${env.VITE_API_URL}/api/v1/documents/${docId}/verify`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								corrected_data: rawData,
								verified_fields: Object.keys(rawData),
								document_type: docType,
							}),
						},
					);

					if (!verifyResp.ok) {
						throw new Error("Auto-verification failed");
					}
					if (!active) {
						return;
					}

					void queryClient.invalidateQueries({ queryKey: ["profile"] });
				} catch (err) {
					console.error(`Auto-verification for doc ${docId} failed:`, err);
					sessionStorage.setItem(blacklistKey, "true");
				}
			}

			if (hasChanges) {
				void queryClient.invalidateQueries({ queryKey: ["profile"] });
			}

			if (active) {
				setAutoVerifying(false);
			}
		};

		void runAutoVerify();

		return () => {
			active = false;
		};
	}, [documents, queryClient, targetTypesKey]);

	return { autoVerifying };
};
