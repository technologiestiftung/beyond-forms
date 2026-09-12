import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Opens a document-flow step in a dialog over the current page. The carried
 * location keeps that page rendered underneath instead of unmounting it.
 */
export const useOpenDocumentFlow = () => {
	const navigate = useNavigate();
	const location = useLocation();

	return useCallback(
		(path: string) => {
			navigate(path, { state: { backgroundLocation: location } });
		},
		[location, navigate],
	);
};
