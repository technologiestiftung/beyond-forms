import { vi } from "vitest";
vi.stubEnv("VITE_USE_MOCK_AUTH", "true");
import "@testing-library/jest-dom";

/**
 * Polyfill for window and browser storage to support testing
 * outside of a full browser environment.
 */
class StorageMock implements Storage {
	private store: Record<string, string> = {};

	get length(): number {
		return Object.keys(this.store).length;
	}

	clear(): void {
		this.store = {};
	}

	getItem(key: string): string | null {
		return this.store[key] || null;
	}

	key(index: number): string | null {
		return Object.keys(this.store)[index] || null;
	}

	removeItem(key: string): void {
		const { [key]: _, ...remaining } = this.store;
		this.store = remaining;
	}

	setItem(key: string, value: string): void {
		this.store[key] = value.toString();
	}
}

Object.defineProperty(window, "localStorage", { value: new StorageMock() });
Object.defineProperty(window, "sessionStorage", { value: new StorageMock() });

window.scrollTo = vi.fn();
vi.stubEnv("VITE_USE_MOCK_AUTH", "true");
vi.stubEnv("VITE_USE_MOCKS", "true");

// Global mock for react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: {
			language: "de",
			changeLanguage: vi.fn(),
		},
	}),
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}));
