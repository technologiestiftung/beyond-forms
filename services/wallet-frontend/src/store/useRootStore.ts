import { useEligibilityStore } from "./useEligibilityStore";
import { useAuthStore } from "./useAuthStore";

export const useRootStore = () => {
	const eligibilityStore = useEligibilityStore();

	const resetAll = () => {
		eligibilityStore.resetForm();
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
