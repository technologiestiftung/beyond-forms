import { useAuthStore } from "../store/useAuthStore";

/**
 * A wrapper around the native fetch API that automatically adds authentication headers
 * and handles common error scenarios like 401 Unauthorized.
 */
export async function authenticatedFetch(
	input: Parameters<typeof fetch>[0],
	init?: Parameters<typeof fetch>[1],
): Promise<Response> {
	const { token, logout } = useAuthStore.getState();

	const headers = new Headers(init?.headers);
	if (token && !headers.has("Authorization")) {
		headers.set("Authorization", `Bearer ${token}`);
	}

	const response = await fetch(input, {
		...init,
		headers,
	});

	if (response.status === 401) {
		await logout();
	}

	return response;
}
