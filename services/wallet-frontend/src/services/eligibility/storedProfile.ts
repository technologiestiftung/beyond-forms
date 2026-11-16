import type { BackendProfile } from "@beyond-forms/eligibility-engine";
import { env } from "../../config/env.config";
import { authenticatedFetch } from "../../utils/apiClient";

export const STORED_PROFILE_KEY = ["storedProfile"];

/** The profile exactly as the backend stores it, which the knowledge base maps field by field */
export const fetchStoredProfile = async (): Promise<BackendProfile> => {
	const response = await authenticatedFetch(`${env.VITE_API_URL}/profile`, {
		credentials: "include",
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch profile: ${response.statusText}`);
	}
	return response.json();
};

export const saveStoredProfile = async (
	patch: BackendProfile,
): Promise<void> => {
	const response = await authenticatedFetch(`${env.VITE_API_URL}/profile`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ...patch, validate_entire_form: false }),
		credentials: "include",
	});
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(
			body.detail ?? `Failed to save profile: ${response.statusText}`,
		);
	}
};
