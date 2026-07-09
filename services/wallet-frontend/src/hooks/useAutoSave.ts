import { useEffect, useRef, useState } from "react";

/**
 * Robust auto-save hook that handles debouncing, partial saves,
 * and ensures data is persisted on unmount.
 * Governing: SPEC-0002, REQ-0003
 */
export function useAutoSave<T>(
	dataToSave: T,
	onSave: (data: T) => Promise<void>,
	delay: number = 500,
) {
	const [isSaving, setIsSaving] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const dataRef = useRef(dataToSave);
	const onSaveRef = useRef(onSave);
	const isInitialMount = useRef(true);
	const isMounted = useRef(true);
	const lastSavedJsonRef = useRef<string>(JSON.stringify(dataToSave));

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	useEffect(() => {
		dataRef.current = dataToSave;
		onSaveRef.current = onSave;
	}, [dataToSave, onSave]);

	useEffect(() => {
		if (isInitialMount.current) {
			isInitialMount.current = false;
			return () => {};
		}

		const currentJson = JSON.stringify(dataToSave);
		if (currentJson === lastSavedJsonRef.current) {
			return () => {};
		}

		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}

		timerRef.current = setTimeout(async () => {
			try {
				if (isMounted.current) {
					setIsSaving(true);
					lastSavedJsonRef.current = currentJson;
					await onSaveRef.current(dataRef.current);
				}
			} catch (error) {
				console.error("Auto-save error:", error);
			} finally {
				if (isMounted.current) {
					setIsSaving(false);
				}
			}
		}, delay);

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
				if (JSON.stringify(dataRef.current) !== lastSavedJsonRef.current) {
					onSaveRef.current(dataRef.current).catch((e) => {
						console.error("Final unmount save failed", e);
					});
				}
			}
		};
	}, [dataToSave, delay]);

	return { isSaving };
}
