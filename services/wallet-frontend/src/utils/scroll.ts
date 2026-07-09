import { useEffect } from "react";

export function scrollToTop(behavior: "auto" | "smooth" = "auto") {
	document.getElementById("main-content")?.scrollTo({ top: 0, behavior });
	window.scrollTo({ top: 0, behavior });
}

/**
 * Hook to scroll to top on a property change.
 * To be used in views which swap content without changing the browser location.
 */
export function useScrollToTop(trigger: unknown) {
	useEffect(() => {
		scrollToTop();
	}, [trigger]);
}
