import { vi } from "vitest";

/** jsdom has no matchMedia; tests default to desktop and opt into mobile. */
let isDesktopViewport = true;

export const setDesktopViewport = (value: boolean) => {
	isDesktopViewport = value;
};

export const installMatchMediaMock = () => {
	isDesktopViewport = true;
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: (query: string) => ({
			matches: isDesktopViewport,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}),
	});
};
