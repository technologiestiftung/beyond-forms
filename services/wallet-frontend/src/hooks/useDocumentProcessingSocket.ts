import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/useAuthStore";
import { useUIStore } from "../store/useUIStore";
import { env } from "../config/env.config";
import type { Profile, WalletDocument } from "../schemas/profile.schema";

/**
 * useDocumentProcessingSocket maintains a WebSocket connection to track
 * real-time document processing status.
 */
export function useDocumentProcessingSocket() {
	const queryClient = useQueryClient();
	const location = useLocation();
	const pathnameRef = useRef(location.pathname);

	useEffect(() => {
		pathnameRef.current = location.pathname;
	}, [location.pathname]);
	const token = useAuthStore((s) => s.token);
	const socketRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	useEffect(() => {
		if (!token) {
			return undefined;
		}

		const connect = () => {
			// Derive WS URL from API URL
			const baseUrl = env.VITE_API_URL.startsWith("http")
				? env.VITE_API_URL.replace(/^http/, "ws")
				: `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${env.VITE_API_URL}`;

			const wsUrl = `${baseUrl}/ws/documents?token=${token}`;

			const socket = new WebSocket(wsUrl);
			socketRef.current = socket;

			socket.onopen = () => {
				if (reconnectTimeoutRef.current) {
					clearTimeout(reconnectTimeoutRef.current);
					reconnectTimeoutRef.current = null;
				}
			};

			socket.onmessage = async (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.type !== "DOCUMENT_PROCESSED") {
						return;
					}

					// Invalidate profile query to trigger a refresh of all components using it
					void queryClient.invalidateQueries({ queryKey: ["profile"] });

					// Immediately fetch latest documents and update store
					const match = pathnameRef.current.match(
						/\/profile\/documents\/([^/]+)\/review/,
					);
					const activeReviewDocId = match ? match[1] : null;

					if (!data.document_id || data.document_id === activeReviewDocId) {
						return;
					}

					const cached = queryClient.getQueryData<{
						profile: Profile | null;
						files: WalletDocument[];
					}>(["profile"]);
					const files = cached?.files || [];
					const doc = files.find((f) => f.id === data.document_id);
					if (!doc) {
						return;
					}

					const showToast = useUIStore.getState().showToast;
					if (doc.status === "READY_FOR_REVIEW") {
						showToast({
							type: "success",
							title: "Dokument verarbeitet",
							message: `Dein Dokument "${doc.name}" wurde erfolgreich analysiert.`,
							docId: doc.id,
						});
					} else if (doc.status === "FAILED") {
						showToast({
							type: "error",
							title: "Verarbeitung fehlgeschlagen",
							message: `Dein Dokument "${doc.name}" konnte nicht verarbeitet werden.`,
							docId: doc.id,
						});
					}
				} catch (err) {
					console.error("Malformed or failed WebSocket message:", err);
				}
			};

			socket.onclose = () => {
				// Simple backoff reconnection
				reconnectTimeoutRef.current = setTimeout(() => {
					connect();
				}, 5000);
			};

			socket.onerror = () => {
				socket.close();
			};
		};

		connect();

		return () => {
			if (socketRef.current) {
				socketRef.current.onclose = null; // Prevent reconnection on manual close
				socketRef.current.close();
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
		};
	}, [token, queryClient]);
}
