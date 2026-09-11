import { useBenefitCheckStore } from "./useBenefitCheckStore";
import { useAuthStore } from "./useAuthStore";

export const useRootStore = () => {
	const benefitCheckStore = useBenefitCheckStore();

	const resetAll = () => {
		benefitCheckStore.resetForm();
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
