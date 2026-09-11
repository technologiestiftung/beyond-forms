import { useEffect, useState } from "react";

/** Mirrors Tailwind's `lg` breakpoint, where the desktop layouts kick in. */
export const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

const matches = () =>
	typeof window.matchMedia === "function" &&
	window.matchMedia(DESKTOP_MEDIA_QUERY).matches;

/** Lets a view render either its mobile or its desktop tree, never both. */
export function useIsDesktop(): boolean {
	const [isDesktop, setIsDesktop] = useState(matches);

	useEffect(() => {
		if (typeof window.matchMedia !== "function") {
			return undefined;
		}

		const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
		const handleChange = (event: MediaQueryListEvent) =>
			setIsDesktop(event.matches);

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	return isDesktop;
}
