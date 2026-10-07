import {
	AssetsBand,
	Binary,
	Citizenship,
	WorkCapacity,
} from "../schemas/eligibility.schema";
import { EligibilityEngine } from "../store/EligibilityEngine";
import type { EligibilityCheck } from "../schemas/eligibility.schema";
import type { AbilityToWorkType } from "../schemas/profile.schema";
import { authenticatedFetch } from "../utils/apiClient";
import { env } from "../config/env.config";

export interface SyncResponse {
	success: boolean;
	message?: string;
}

const ABILITY_TO_WORK: Record<WorkCapacity, AbilityToWorkType> = {
	[WorkCapacity.FULL]: "Fully able",
	[WorkCapacity.TEMPORARILY_REDUCED]: "Temporarily disabled",
	[WorkCapacity.PERMANENTLY_REDUCED]: "Permanently disabled",
};

/** The backend fills the form's "assets over 10,000 €" field from has_assets. */
const ASSETS_OVER_10000: Record<AssetsBand, boolean> = {
	[AssetsBand.UNDER_5000]: false,
	[AssetsBand.FROM_5000_TO_10000]: false,
	[AssetsBand.FROM_10000_TO_12500]: true,
	[AssetsBand.FROM_12500_TO_20000]: true,
	[AssetsBand.OVER_20000]: true,
};

export const mapEligibilityToProfilePayload = (
	allAnswers: Partial<EligibilityCheck>,
): Record<string, unknown> => {
	const answers = EligibilityEngine.answersOnValidPath(allAnswers);
	const payload: Record<string, unknown> = {};

	if (answers.dateOfBirth) {
		payload.date_of_birth = answers.dateOfBirth;
	}

	if (answers.livesInGermany) {
		payload.is_resident_in_germany = answers.livesInGermany === Binary.YES;
	}

	if (answers.citizenship === Citizenship.NON_EU) {
		payload.is_german_citizen = false;
		if (answers.hasSecureResidenceStatus === Binary.YES) {
			payload.residence_status = "Other";
		}
	}

	if (answers.workCapacity) {
		payload.ability_to_work = ABILITY_TO_WORK[answers.workCapacity];
		if (answers.workCapacity === WorkCapacity.PERMANENTLY_REDUCED) {
			payload.has_permanent_reduction_in_earning_capacity = true;
		}
	}

	if (answers.assetsBand) {
		payload.has_assets = ASSETS_OVER_10000[answers.assetsBand];
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
