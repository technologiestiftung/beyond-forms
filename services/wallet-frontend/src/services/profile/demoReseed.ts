import { env } from "../../config/env.config";
import type { DemoPersona } from "../../config/demoPersonas";
import { authenticatedFetch } from "../../utils/apiClient";
import { useEligibilityStore } from "../../store/useEligibilityStore";
import { getMockProfileStorageKey } from "../../utils/profile";

export async function reseedDemoProfile(persona: DemoPersona): Promise<void> {
	if (env.VITE_USE_MOCKS || env.VITE_USE_MOCK_AUTH) {
		localStorage.setItem(
			getMockProfileStorageKey(persona.phoneNumber),
			JSON.stringify(persona.getProfile()),
		);
		useEligibilityStore.getState().setAnswers(persona.eligibilityAnswers);
		return;
	}
	const response = await authenticatedFetch(`${env.VITE_API_URL}/demo/reseed`, {
		method: "POST",
		credentials: "include",
	});
	if (!response.ok) {
		throw new Error(`Failed to reseed demo profile: ${response.statusText}`);
	}
	useEligibilityStore.getState().setAnswers(persona.eligibilityAnswers);
}
