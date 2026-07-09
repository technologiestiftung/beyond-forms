import { z } from "zod";

const emptyToUndefined = (val: unknown) =>
	typeof val === "string" && val.trim() === "" ? undefined : val;

const EnvSchema = z.object({
	VITE_AUTH_URL: z.preprocess(
		emptyToUndefined,
		z.string().default("/auth-proxy"),
	),
	VITE_API_URL: z.preprocess(emptyToUndefined, z.string().default("/api")),
	VITE_USE_MOCK_AUTH: z
		.preprocess((val) => val === "true" || val === true, z.boolean())
		.default(false),
	VITE_USE_MOCKS: z
		.preprocess((val) => val === "true" || val === true, z.boolean())
		.default(false),
	VITE_BYPASS_AUTH: z
		.preprocess((val) => val === "true" || val === true, z.boolean())
		.default(false),
});

const rawEnv = {
	VITE_AUTH_URL: import.meta.env.VITE_AUTH_URL,
	VITE_API_URL: import.meta.env.VITE_API_URL,
	VITE_USE_MOCK_AUTH: import.meta.env.VITE_USE_MOCK_AUTH,
	VITE_USE_MOCKS: import.meta.env.VITE_USE_MOCKS,
	VITE_BYPASS_AUTH: import.meta.env.VITE_BYPASS_AUTH,
};

const _env = EnvSchema.safeParse(rawEnv);

if (!_env.success) {
	console.error(
		"❌ Environment validation failed. Using defaults where possible.",
	);
	console.error("Errors:", _env.error.flatten().fieldErrors);
	console.error("Raw values received:", rawEnv);
}

// Export the data if successful, otherwise use defaults by re-parsing an empty object
export const env = _env.success ? _env.data : EnvSchema.parse({});
