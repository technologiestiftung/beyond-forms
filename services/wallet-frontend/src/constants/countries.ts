export interface CountryOption {
	code: string;
	englishName: string;
}

export const COUNTRY_OPTIONS: readonly CountryOption[] = [
	{ code: "DE", englishName: "Germany" },
	{ code: "FR", englishName: "France" },
	{ code: "AT", englishName: "Austria" },
	{ code: "CH", englishName: "Switzerland" },
	{ code: "PL", englishName: "Poland" },
	{ code: "CZ", englishName: "Czech Republic" },
	{ code: "NL", englishName: "Netherlands" },
	{ code: "GB", englishName: "United Kingdom" },
	{ code: "UA", englishName: "Ukraine" },
	{ code: "TR", englishName: "Turkey" },
	{ code: "US", englishName: "United States" },
	{ code: "CA", englishName: "Canada" },
	{ code: "PT", englishName: "Portugal" },
] as const;

export const COUNTRY_CODES = [
	{ code: "+49", name: "Germany", flag: "🇩🇪" },
	{ code: "+43", name: "Austria", flag: "🇦🇹" },
	{ code: "+41", name: "Switzerland", flag: "🇨🇭" },
	{ code: "+48", name: "Poland", flag: "🇵🇱" },
	{ code: "+420", name: "Czech Republic", flag: "🇨🇿" },
	{ code: "+33", name: "France", flag: "🇫🇷" },
	{ code: "+31", name: "Netherlands", flag: "🇳🇱" },
	{ code: "+44", name: "UK", flag: "🇬🇧" },
	{ code: "+380", name: "Ukraine", flag: "🇺🇦" },
	{ code: "+90", name: "Turkey", flag: "🇹🇷" },
	{ code: "+1", name: "USA/Canada", flag: "🇺🇸" },
];

export const COUNTRIES = [
	{ code: "DE", name: "personal.countries.DE" },
	{ code: "FR", name: "personal.countries.FR" },
	{ code: "AT", name: "personal.countries.AT" },
	{ code: "CH", name: "personal.countries.CH" },
	{ code: "PL", name: "personal.countries.PL" },
	{ code: "CZ", name: "personal.countries.CZ" },
	{ code: "NL", name: "personal.countries.NL" },
	{ code: "GB", name: "personal.countries.GB" },
	{ code: "UA", name: "personal.countries.UA" },
	{ code: "TR", name: "personal.countries.TR" },
	{ code: "US", name: "personal.countries.US" },
	{ code: "CA", name: "personal.countries.CA" },
];
