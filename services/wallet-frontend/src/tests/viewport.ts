import { vi } from "vitest";

/** jsdom has no matchMedia; tests default to desktop and opt into mobile. */
let isDesktopViewport = true;

type ChangeListener = (event: MediaQueryListEvent) => void;

const listeners = new Set<ChangeListener>();

export const setDesktopViewport = (value: boolean) => {
	if (isDesktopViewport === value) {
		return;
	}
	isDesktopViewport = value;

	// Mounted consumers only re-render when the query actually notifies them.
	const event = {
		matches: value,
		media: "",
		type: "change",
	} as MediaQueryListEvent;
	listeners.forEach((listener) => listener(event));
};

export const installMatchMediaMock = () => {
	isDesktopViewport = true;
	listeners.clear();
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: (query: string) => ({
			get matches() {
				return isDesktopViewport;
			},
			media: query,
			onchange: null,
			addEventListener: vi.fn(
				(type: string, listener: ChangeListener) =>
					type === "change" && listeners.add(listener),
			),
			removeEventListener: vi.fn(
				(type: string, listener: ChangeListener) =>
					type === "change" && listeners.delete(listener),
			),
			addListener: vi.fn((listener: ChangeListener) => listeners.add(listener)),
			removeListener: vi.fn((listener: ChangeListener) =>
				listeners.delete(listener),
			),
			dispatchEvent: vi.fn(),
		}),
	});
};
