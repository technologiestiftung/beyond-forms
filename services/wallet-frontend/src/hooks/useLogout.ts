import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "../constants/routes";
import { useAuthStore } from "../store/useAuthStore";
import { useProfileStore } from "../store/useProfileStore";

const KEYS_TO_PURGE = [
	"beyond-forms-profile-ui",
	"beyond-forms-preferences",
	"beyond-forms-chat",
	"beyond-forms-tutorial-session",
	"beyond-forms-auth-session",
	"beyond-forms-wallet-session",
];

export const clearSessionAndStorage = () => {
	KEYS_TO_PURGE.forEach((key) => {
		localStorage.removeItem(key);
		sessionStorage.removeItem(key);
	});
};

/**
 * Signs the user out and clears every persisted store, shared by the settings
 * page and the desktop sidebar so both purge exactly the same keys.
 */
export const useLogout = () => {
	const navigate = useNavigate();
	const logout = useAuthStore((s) => s.logout);
	const resetProfileStore = useProfileStore((s) => s.reset);

	return useCallback(async () => {
		try {
			resetProfileStore();
			await logout();
		} catch (e) {
			console.error("Deep logout failed:", e);
		}
		clearSessionAndStorage();
		navigate(AppRoutes.Home);
	}, [logout, navigate, resetProfileStore]);
};
