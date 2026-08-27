import helmutPersona from "../../../../demo/personas/helmut.json";
import sabinePersona from "../../../../demo/personas/sabine.json";
import sandorPersona from "../../../../demo/personas/sandor.json";
import { buildDemoProfileFromPersona } from "../services/profile/demoPersonaAdapter";

export interface DemoPersona {
	slug: string;
	displayName: string;
	phoneNumber: string;
	statusKey: string;
	fallbackStatus: string;
	getProfile: () => ReturnType<typeof buildDemoProfileFromPersona>;
}

/**
 * Always-visible login personas, each tied to a fixed Bundesnetzagentur
 * "drama number" that skips SMS verification (any 6-digit code works) on
 * both the mock provider and the real staging auth-proxy. Add more personas 
 * here as they're built.
 *
 * Profile data is sourced from demo/personas/*.json (single source of truth),
 * imported directly and transformed via buildDemoProfileFromPersona. UI-only
 * overrides (displayName, personaAddress) are specified here.
 */
export const DEMO_PERSONAS: DemoPersona[] = [
	{
		slug: "helmut",
		displayName: "Helmut",
		phoneNumber: "+493023125102",
		statusKey: "persona_picker.personas.helmut.status",
		fallbackStatus: "Alle Dokumente vollständig und verifiziert",
		getProfile: () =>
			buildDemoProfileFromPersona(helmutPersona as never, {
				displayName: "Helmut",
				personaAddress: "Formal",
			}),
	},
	{
		slug: "sabine",
		displayName: "Sabine",
		phoneNumber: "+493023125101",
		statusKey: "persona_picker.personas.sabine.status",
		fallbackStatus: "Ein Dokument fehlt noch",
		getProfile: () =>
			buildDemoProfileFromPersona(sabinePersona as never, {
				displayName: "Sabine",
				personaAddress: "Formal",
			}),
	},
	{
		slug: "sandor",
		displayName: "Sandor",
		phoneNumber: "+493023125103",
		statusKey: "persona_picker.personas.sandor.status",
		fallbackStatus: "Ein Dokument ist unleserlich",
		getProfile: () =>
			buildDemoProfileFromPersona(sandorPersona as never, {
				displayName: "Sandor",
				personaAddress: "Informal",
			}),
	},
];

/**
 * Drama-number prefixes that skip SMS verification, excluding the Berlin
 * prefix (reserved for the three personas above, ending in 101/102/103).
 */
const OWN_DRAMA_PREFIXES = [
	"+496990009", // Frankfurt
	"+494066969", // Hamburg
	"+492214710", // Köln
	"+498999998", // München
];

/**
 * Generates a fresh, personal drama number for "create a new profile" — one
 * of the non-reserved city prefixes plus a random 3-digit suffix, so it can
 * never collide with the three fixed persona numbers above.
 */
export function generateOwnDramaNumber(): string {
	const prefix =
		OWN_DRAMA_PREFIXES[Math.floor(Math.random() * OWN_DRAMA_PREFIXES.length)];
	const suffix = Math.floor(Math.random() * 1000)
		.toString()
		.padStart(3, "0");
	return `${prefix}${suffix}`;
}
