import { vi } from "vitest";
vi.stubEnv("VITE_USE_MOCK_AUTH", "true");
import "@testing-library/jest-dom";
import { installMatchMediaMock } from "./viewport";

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

installMatchMediaMock();

// Global mock for react-i18next: returns the key, plus any interpolation values.
vi.mock("react-i18next", () => {
	const i18nextOptions = new Set([
		"ns",
		"defaultValue",
		"returnObjects",
		"lng",
	]);
	return {
		useTranslation: () => ({
			t: (key: string, options?: Record<string, unknown>) => {
				const values = Object.fromEntries(
					Object.entries(options ?? {}).filter(
						([name]) => !i18nextOptions.has(name),
					),
				);
				return Object.keys(values).length > 0
					? `${key} ${JSON.stringify(values)}`
					: key;
			},
			i18n: {
				language: "de",
				changeLanguage: vi.fn(),
			},
		}),
		initReactI18next: {
			type: "3rdParty",
			init: vi.fn(),
		},
	};
});
