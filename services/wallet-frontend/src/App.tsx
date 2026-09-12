import { Suspense, useEffect, useState, type ComponentType } from "react";
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	matchPath,
	useLocation,
	useNavigate,
	type Location,
} from "react-router-dom";
import { AppShell } from "./components/Layout/AppShell";
import { AppRoutes } from "./constants/routes";
import { routeConfig } from "./config/routeConfig";
import { DocumentFlowDialog } from "./views/Profile/documents/DocumentFlowDialog";
import { BACKGROUND_ROUTES_ID } from "./constants/dom";
import { ErrorBoundary } from "./components/Error/ErrorBoundary";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { ScrollToTop } from "./components/Layout/ScrollToTop";
import { useAriaAnnouncer } from "./hooks/useAriaAnnouncer";
import { useDocumentProcessingSocket } from "./hooks/useDocumentProcessingSocket";
import { useUIStore } from "./store/useUIStore";
import { useTranslation } from "react-i18next";
import { Toast } from "./components/ui/Toast";
import "./index.css";
import "./i18n";

/** Opened with a `backgroundLocation` these render in a dialog over that page. */
const DOCUMENT_FLOW_PATHS: string[] = [
	AppRoutes.ProfilePersonalDataUpload,
	AppRoutes.ProfileDocumentReview,
	AppRoutes.ProfileDocumentSuccess,
];

const documentFlowRoutes = routeConfig.filter((route) =>
	DOCUMENT_FLOW_PATHS.includes(route.path),
);

const renderRouteElement = (Component: ComponentType, auth?: boolean) =>
	auth ? (
		<ProtectedRoute>
			<Component />
		</ProtectedRoute>
	) : (
		<Component />
	);

function AppContent() {
	const { t } = useTranslation("common");
	const { announcement } = useAriaAnnouncer();
	useDocumentProcessingSocket();
	const location = useLocation();
	const navigate = useNavigate();
	const { toast, hideToast } = useUIStore();
	const [flowBackground, setFlowBackground] = useState<Location | null>(null);

	const requestedBackground =
		(location.state as { backgroundLocation?: Location } | null)
			?.backgroundLocation ?? null;
	const isDocumentFlowRoute = DOCUMENT_FLOW_PATHS.some((path) =>
		matchPath(path, location.pathname),
	);

	// Derived while rendering so the dialog arrives with its step, not a frame later.
	if (requestedBackground && requestedBackground.key !== flowBackground?.key) {
		setFlowBackground(requestedBackground);
	} else if (flowBackground && !isDocumentFlowRoute) {
		setFlowBackground(null);
	}

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const bypassKey = params.get("test_bypass");
		if (bypassKey) {
			sessionStorage.setItem("bf_bypass_key", bypassKey);
			params.delete("test_bypass");
			const newSearch = params.toString() ? `?${params.toString()}` : "";
			navigate(`${location.pathname}${newSearch}${location.hash}`, {
				replace: true,
			});
		}
	}, [location.search, location.pathname, location.hash, navigate]);

	const handleToastClick = () => {
		if (toast?.docId) {
			const origin = location.pathname.includes("/dashboard")
				? "wizard"
				: "hub";
			navigate(
				`${AppRoutes.ProfileDocumentReview.replace(
					":documentId",
					toast.docId,
				)}?origin=${origin}`,
			);
			hideToast();
		}
	};

	return (
		<>
			<div aria-live="polite" aria-atomic="true" className="sr-only">
				{announcement}
			</div>

			{/*
        INNER ERROR BOUNDARY:
        Handles route-level failures (e.g. lazy loading chunks failing or data fetching errors).
        It uses a 'reload' strategy to try and recover the specific component.
        The 'key' ensures it resets when navigating between different pages, and
      it stays put while a flow runs in a dialog over the current page.
      */}
			<ErrorBoundary
				key={(flowBackground || location).pathname}
				resetStrategy="reload"
			>
				<div id={BACKGROUND_ROUTES_ID}>
					<Suspense
						fallback={
							<main className="flex min-h-screen items-center justify-center bg-brand-bg">
								<h1 className="sr-only">{t("loading_app")}</h1>
								<div className="size-12 border-4 border-brand-black/30 border-t-brand-black rounded-full animate-spin" />
							</main>
						}
					>
						<Routes location={flowBackground || location}>
							<Route element={<AppShell />}>
								{routeConfig.map((route) => {
									const element = renderRouteElement(
										route.component,
										route.metadata.requiresAuth,
									);

									return (
										<Route
											key={route.path}
											path={route.path}
											element={element}
										/>
									);
								})}
								<Route
									path="*"
									element={<Navigate to={AppRoutes.Home} replace />}
								/>
							</Route>
						</Routes>
					</Suspense>
				</div>

				{flowBackground && (
					<Routes>
						<Route element={<DocumentFlowDialog background={flowBackground} />}>
							{documentFlowRoutes.map((route) => (
								<Route
									key={route.path}
									path={route.path}
									element={renderRouteElement(
										route.component,
										route.metadata.requiresAuth,
									)}
								/>
							))}
						</Route>
					</Routes>
				)}
			</ErrorBoundary>

			<Toast
				show={!!toast?.show}
				type={toast?.type}
				title={toast?.title || ""}
				message={toast?.message || ""}
				onClose={hideToast}
				onClick={toast?.docId ? handleToastClick : undefined}
			/>
		</>
	);
}

/**
 * OUTER ERROR BOUNDARY:
 * The ultimate safety net for the entire application.
 * Catches catastrophic initialization failures or bugs in global providers/AppContent.
 */
function App() {
	return (
		<ErrorBoundary>
			<BrowserRouter>
				<ScrollToTop />
				<AppContent />
			</BrowserRouter>
		</ErrorBoundary>
	);
}

export default App;
