import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollToTop } from "../../utils/scroll";

/**
 * Scroll to top on location path changes.
 * NOTE: This is based off of https://v5.reactrouter.com/web/guides/scroll-restoration
 * if we migrating react routing to use a data router
 * (https://reactrouter.com/6.30.3/routers/picking-a-router)
 * this can be replaced by the native <ScrollRestoration />
 * (https://reactrouter.com/api/components/ScrollRestoration)
 */
export function ScrollToTop() {
	const { pathname } = useLocation();
	useLayoutEffect(() => {
		scrollToTop();
	}, [pathname]);
	return null;
}
