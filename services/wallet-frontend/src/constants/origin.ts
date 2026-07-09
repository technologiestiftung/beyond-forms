export const Origins = {
	WIZARD: "wizard",
	HUB: "hub",
	UNKNOWN: "unknown",
} as const;

export type OriginType = (typeof Origins)[keyof typeof Origins];
