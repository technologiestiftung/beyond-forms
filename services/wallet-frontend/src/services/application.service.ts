import {
	AssetsBand,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../schemas/benefitCheck.schema";
import type {
	ChildEntry,
	PartialBenefitCheckAnswers,
} from "../schemas/benefitCheck.schema";
import { authenticatedFetch } from "../utils/apiClient";
import { env } from "../config/env.config";

/**
 * One row of the profile's `associated_persons`, as `GET /profile` returns it. Only the
 * fields the merge reasons about are named; the rest are carried through untouched.
 */
export interface AssociatedPersonRow {
	association_type: string;
	date_of_birth?: string | null;
	[key: string]: unknown;
}

const CHILD = "Child";

/**
 * Adds the questionnaire's children to the collection the profile already has.
 *
 * `sort_order` is deliberately not set: the server assigns it by position on write.
 */
export const mergeChildren = (
	existing: AssociatedPersonRow[],
	children: ChildEntry[],
): AssociatedPersonRow[] => {
	// Counted rather than a Set, so twins already half-recorded still gain their sibling.
	const unmatched = new Map<string, number>();
	for (const row of existing) {
		if (row.association_type === CHILD) {
			const key = row.date_of_birth ?? "";
			unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
		}
	}

	const added: AssociatedPersonRow[] = [];
	for (const child of children) {
		const remaining = unmatched.get(child.dateOfBirth) ?? 0;
		if (remaining > 0) {
			unmatched.set(child.dateOfBirth, remaining - 1);
			continue;
		}
		added.push({
			association_type: CHILD,
			lives_in_household: true,
			date_of_birth: child.dateOfBirth,
		});
	}

	return [...existing, ...added];
};

export interface SyncResponse {
	success: boolean;
	message?: string;
}

const MARITAL_STATUS_BY_COMPOSITION: Record<HouseholdComposition, string> = {
	[HouseholdComposition.SINGLE]: "Single",
	[HouseholdComposition.SINGLE_PARENT]: "Single",
	[HouseholdComposition.COUPLE_NO_CHILDREN]: "Cohabiting",
	[HouseholdComposition.COUPLE_WITH_CHILDREN]: "Cohabiting",
};

const ABILITY_TO_WORK_BY_CAPACITY: Record<WorkCapacity, string> = {
	[WorkCapacity.FULL]: "Fully able",
	[WorkCapacity.TEMPORARILY_REDUCED]: "Temporarily disabled",
	[WorkCapacity.PERMANENTLY_REDUCED]: "Permanently disabled",
};

/**
 * Answers that reach the profile when a guest signs in.
 *
 * GAP: three answers have no column and are deliberately left out — monthlyGrossIncome
 * (monthly_income is documented as net), assetsBand (only the has_assets boolean exists),
 * and monthlyWarmRent (rent_total, heating_costs and hot_water_costs exist separately, and
 * a warm rent cannot be split back into them without inventing numbers). Sending them would
 * return HTTP 200 and silently discard them: the schema sets no extra="forbid".
 *
 * Those three are why `profileToBenefitAnswers` cannot rebuild the means tests, and why the
 * dashboard only ever folds away a benefit on a categorical ground.
 *
 * Children are deliberately absent from this function. They need the profile's current
 * collection to merge against, which makes the step asynchronous; syncGuestData handles
 * it so this mapper stays pure and directly testable.
 */
export const mapEligibilityToProfilePayload = (
	answers: PartialBenefitCheckAnswers,
): Record<string, unknown> => {
	const payload: Record<string, unknown> = {};

	if (answers.dateOfBirth) {
		payload.date_of_birth = answers.dateOfBirth;
	}

	if (answers.livesInGermany !== undefined) {
		payload.is_resident_in_germany = answers.livesInGermany;
	}

	if (answers.citizenship === Citizenship.DE_EU) {
		payload.is_german_citizen = true;
		payload.nationality = "DE";
		payload.residence_status = "Citizen";
	} else if (answers.citizenship === Citizenship.NON_EU) {
		payload.is_german_citizen = false;
		if (answers.hasSecureResidenceStatus !== undefined) {
			payload.residence_status = answers.hasSecureResidenceStatus
				? "PermanentResident"
				: "Other";
		}
	}

	if (answers.workCapacity !== undefined) {
		payload.ability_to_work = ABILITY_TO_WORK_BY_CAPACITY[answers.workCapacity];
		if (answers.workCapacity === WorkCapacity.PERMANENTLY_REDUCED) {
			payload.has_permanent_reduction_in_earning_capacity = true;
		}
	}

	if (answers.assetsBand !== undefined) {
		payload.has_assets = answers.assetsBand !== AssetsBand.UNDER_5000;
	}

	if (answers.householdComposition !== undefined) {
		payload.marital_status =
			MARITAL_STATUS_BY_COMPOSITION[answers.householdComposition];
		const adults =
			answers.householdComposition ===
				HouseholdComposition.COUPLE_NO_CHILDREN ||
			answers.householdComposition === HouseholdComposition.COUPLE_WITH_CHILDREN
				? 2
				: 1;
		payload.persons_in_household_count =
			adults + (answers.children?.length ?? 0);
	}

	if (answers.monthlyNetHouseholdIncome !== undefined) {
		payload.monthly_income = answers.monthlyNetHouseholdIncome;
	}

	if (answers.receivesBenefitsAlready !== undefined) {
		payload.has_applied_for_benefits_awaiting_decision =
			answers.receivesBenefitsAlready;
	}

	return payload;
};

/**
 * Reads the profile's current `associated_persons`.
 *
 * A raw GET rather than profileService.getProfile(): the frontend Profile type has no
 * associatedPersons field, so mapProfileToFrontend drops the collection. Extending
 * ProfileSchema was rejected — mapProfileToBackend flattens every section into the
 * payload, so any profile save would then replace the collection, and a stale frontend
 * copy could silently wipe someone's household.
 *
 * Returns null when the profile cannot be read, which the caller treats as "leave the
 * children out" rather than "there are none".
 */
const readAssociatedPersons = async (): Promise<
	AssociatedPersonRow[] | null
> => {
	try {
		const response = await authenticatedFetch(`${env.VITE_API_URL}/profile`, {
			method: "GET",
			credentials: "include",
		});
		if (!response.ok) {
			return null;
		}
		const data = (await response.json()) as {
			associated_persons?: unknown;
		};
		return Array.isArray(data.associated_persons)
			? (data.associated_persons as AssociatedPersonRow[])
			: [];
	} catch {
		return null;
	}
};

export const applicationService = {
	async syncGuestData(
		answers: PartialBenefitCheckAnswers,
	): Promise<SyncResponse> {
		if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
			return { success: true };
		}
		const payload = mapEligibilityToProfilePayload(answers);
		if (Object.keys(payload).length === 0) {
			return { success: true };
		}

		if (answers.children !== undefined && answers.children.length > 0) {
			const existing = await readAssociatedPersons();
			if (existing !== null) {
				payload.associated_persons = mergeChildren(existing, answers.children);
			}
			// GAP: the read failed. The children are left out and everything else is
			// still sent, so the worst case is the state before this merge existed.
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
