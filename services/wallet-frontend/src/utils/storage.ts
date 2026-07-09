/**
 * createSecureStorage provides a clean wrapper around browser storage.
 * Obfuscation removed for MVP stability - prioritizing reliable state sync.
 */
export const createSecureStorage = (type: "local" | "session" = "local") => {
	const storage =
		type === "local" ? window.localStorage : window.sessionStorage;

	return {
		getItem: (key: string): string | null => {
			try {
				return storage.getItem(key);
			} catch (_e) {
				// Fallback for private browsing or disabled storage
				return null;
			}
		},
		setItem: (key: string, value: string): void => {
			try {
				storage.setItem(key, value);
			} catch (_e) {
				// Silently fail on quota or access errors
			}
		},
		removeItem: (key: string): void => {
			storage.removeItem(key);
		},
		clear: (): void => {
			storage.clear();
		},
	};
};

/**
 * Custom storage adapter for Zustand persist middleware
 */
export const createZustandStorage = (type: "local" | "session") => ({
	getItem: (name: string) => createSecureStorage(type).getItem(name),
	setItem: (name: string, value: string) =>
		createSecureStorage(type).setItem(name, value),
	removeItem: (name: string) => createSecureStorage(type).removeItem(name),
	clear: () => createSecureStorage(type).clear(),
});
