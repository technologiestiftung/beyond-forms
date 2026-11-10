import { useEligibilityStore } from "./useEligibilityStore";
import { useAuthStore } from "./useAuthStore";
import { useDiscoveryStore } from "./useDiscoveryStore";

export const useRootStore = () => {
	const eligibilityStore = useEligibilityStore();

	const resetAll = () => {
		eligibilityStore.resetForm();
		useDiscoveryStore.getState().reset();
		useAuthStore.getState().logout();

		const lng = localStorage.getItem("i18nextLng");
		localStorage.clear();
		sessionStorage.clear();
		if (lng) {
			localStorage.setItem("i18nextLng", lng);
		}
	};

	return {
		resetAll,
	};
};
