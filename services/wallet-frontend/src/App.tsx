import { Suspense, useEffect } from "react";
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	useLocation,
	useNavigate,
} from "react-router-dom";
import { AppShell } from "./components/Layout/AppShell";
import { AppRoutes } from "./constants/routes";
import { routeConfig } from "./config/routeConfig";
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

function AppContent() {
	const { t } = useTranslation("common");
	const { announcement } = useAriaAnnouncer();
	useDocumentProcessingSocket();
	const location = useLocation();
	const navigate = useNavigate();
	const { toast, hideToast } = useUIStore();

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
        The 'key' ensures it resets when navigating between different pages.
      */}
			<ErrorBoundary key={location.pathname} resetStrategy="reload">
				<Suspense
					fallback={
						<main className="flex min-h-screen items-center justify-center bg-brand-bg">
							<h1 className="sr-only">{t("loading_app")}</h1>
							<div className="size-12 border-4 border-brand-black/30 border-t-brand-black rounded-full animate-spin" />
						</main>
					}
				>
					<Routes>
						<Route element={<AppShell />}>
							{routeConfig.map((route) => {
								const Component = route.component;
								const element = route.metadata.requiresAuth ? (
									<ProtectedRoute>
										<Component />
									</ProtectedRoute>
								) : (
									<Component />
								);

								return (
									<Route key={route.path} path={route.path} element={element} />
								);
							})}
							<Route
								path="*"
								element={<Navigate to={AppRoutes.Home} replace />}
							/>
						</Route>
					</Routes>
				</Suspense>
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
