import {
	Binary,
	NationalityStatus,
	PensionStatus,
} from "../schemas/eligibility.schema";
import type { EligibilityCheck } from "../schemas/eligibility.schema";
import { authenticatedFetch } from "../utils/apiClient";
import { env } from "../config/env.config";

export interface SyncResponse {
	success: boolean;
	message?: string;
}

export const mapEligibilityToProfilePayload = (
	answers: Partial<EligibilityCheck>,
): Record<string, unknown> => {
	const payload: Record<string, unknown> = {};

	if (answers.dateOfBirth) {
		payload.date_of_birth = answers.dateOfBirth;
	}

	if (answers.livesInGermany) {
		payload.is_resident_in_germany = answers.livesInGermany === Binary.YES;
	}

	if (answers.nationality) {
		if (answers.nationality === NationalityStatus.GERMAN) {
			payload.is_german_citizen = true;
			payload.nationality = "DE";
			payload.residence_status = "Citizen";
		} else if (answers.nationality === NationalityStatus.EU_5_PLUS) {
			payload.is_german_citizen = false;
			payload.nationality = "EU";
			payload.residence_status = "PermanentResident";
		} else if (answers.nationality === NationalityStatus.RESIDENCE_PERMIT) {
			payload.is_german_citizen = false;
			payload.residence_status = "Other";
		}
	}

	if (answers.pension) {
		if (answers.pension === PensionStatus.OLD_AGE) {
			payload.income_sources = ["Altersrente"];
		} else if (answers.pension === PensionStatus.REDUCED_EARNING_CAPACITY) {
			payload.income_sources = ["Erwerbsminderungsrente"];
			payload.ability_to_work = "Permanently disabled";
			payload.has_permanent_reduction_in_earning_capacity = true;
		}
	}

	if (answers.hasAssetsAboveThreshold) {
		payload.has_assets = answers.hasAssetsAboveThreshold === Binary.YES;
	}

	return payload;
};

export const applicationService = {
	async syncGuestData(
		answers: Partial<EligibilityCheck>,
	): Promise<SyncResponse> {
		if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
			return { success: true };
		}
		const payload = mapEligibilityToProfilePayload(answers);
		if (Object.keys(payload).length === 0) {
			return { success: true };
		}

		try {
			const response = await authenticatedFetch(`${env.VITE_API_URL}/profile`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				credentials: "include",
			});

			if (!response.ok) {
				return {
					success: false,
					message: `Failed to synchronize guest data: ${response.statusText}`,
				};
			}
			return { success: true };
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : String(error),
			};
		}
	},
};
