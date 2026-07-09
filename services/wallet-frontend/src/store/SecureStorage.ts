export interface StorageAdapter {
	getItem: (key: string) => string | null;
	setItem: (key: string, value: string) => void;
	removeItem: (key: string) => void;
	clear: () => void;
}

class SecureStorageAdapter implements StorageAdapter {
	private storage: Storage;

	constructor(type: "session" | "local" = "session") {
		this.storage =
			type === "session" ? window.sessionStorage : window.localStorage;
	}

	getItem(key: string): string | null {
		return this.storage.getItem(key);
	}

	setItem(key: string, value: string): void {
		this.storage.setItem(key, value);
	}

	removeItem(key: string): void {
		this.storage.removeItem(key);
	}

	clear(): void {
		this.storage.clear();
	}
}

export const secureSessionStorage = new SecureStorageAdapter("session");
