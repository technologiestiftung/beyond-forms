/**
 * Application Configuration
 * Defines centralized, configurable properties for the Grundsicherung application flow.
 */

export interface RequiredDocumentSlot {
	id: string;
	titleKey: string;
	defaultTitle: string;
	badgeKey: string;
	defaultBadge: string;
}

/**
 * Definitive list of mandatory required documents.
 * Centralizing this allows easy configuration and avoids hardcoding duplicate slots in views.
 */
export const REQUIRED_DOCUMENT_SLOTS: RequiredDocumentSlot[] = [
	// --- 1. IDENTITÄT & PERSÖNLICHE DOKUMENTE (Identity & Personal Status) ---
	// Source: Document Intelligence Service (document_types.py Section 2) & Conference Conference Tab
	{
		id: "id_card",
		titleKey: "docs.slots.id_card",
		defaultTitle: "Personalausweis oder Reisepass",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "registration",
		titleKey: "docs.slots.registration",
		defaultTitle: "Meldebescheinigung",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "health_insurance",
		titleKey: "docs.slots.health_insurance",
		defaultTitle: "Nachweis der Krankenversicherungsmitgliedschaft",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},

	// --- 2. EINKOMMEN und FINANZEN (Income & Financial Declarations) ---
	// Source: Document Intelligence Service (document_types.py Sections 1, 3, 4) & Conference Conference Tab
	{
		id: "pension_notice",
		titleKey: "docs.slots.pension_notice",
		defaultTitle: "Erstrentenbescheid",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "stmt3",
		titleKey: "docs.slots.stmt3",
		defaultTitle: "Kontoauszüge der letzten 3 Monate",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "income",
		titleKey: "docs.slots.income",
		defaultTitle: "Einkommenserklärung (Anlage Einkommen)",
		badgeKey: "docs.badges.form",
		defaultBadge: "Formular",
	},
	{
		id: "assets",
		titleKey: "docs.slots.assets",
		defaultTitle: "Anlage Vermögen",
		badgeKey: "docs.badges.form",
		defaultBadge: "Formular",
	},
	{
		id: "bank",
		titleKey: "docs.slots.bank",
		defaultTitle: "Bankdaten",
		badgeKey: "docs.badges.form",
		defaultBadge: "Formular",
	},

	// --- 3. WOHNEN und WOHNKOSTEN (Housing & Operational Costs) ---
	// Source: Document Intelligence Service (document_types.py Section 6) & Conference Conference Tab
	{
		id: "rent",
		titleKey: "docs.slots.rent",
		defaultTitle: "Mietvertrag",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "utility_bill",
		titleKey: "docs.slots.utility_bill",
		defaultTitle: "Nebenkostenrechnung Deiner Wohnung",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "heating",
		titleKey: "docs.slots.heating",
		defaultTitle: "Heizkostennachweis (Gas-/Wärmerechnung)",
		badgeKey: "docs.badges.proof",
		defaultBadge: "Nachweis",
	},
	{
		id: "housing",
		titleKey: "docs.slots.housing",
		defaultTitle: "Anlage Unterkunft / Kosten der Unterkunft",
		badgeKey: "docs.badges.form",
		defaultBadge: "Formular",
	},

	// --- 4. ANTRÄGE & ERKLÄRUNGEN (Declarations & Compliance Agreements) ---
	// Source: Conference Guided Application Interaction Flow
	{
		id: "cooperation_agreement",
		titleKey: "docs.slots.cooperation_agreement",
		defaultTitle: "Mitwirkungsverpflichtung + Datenschutzerklärung",
		badgeKey: "docs.badges.form",
		defaultBadge: "Formular",
	},
	{
		id: "household",
		titleKey: "docs.slots.household",
		defaultTitle: "Haushaltsangehörige/Bedarfsgemeinschaftserklärung",
		badgeKey: "docs.badges.form",
		defaultBadge: "Formular",
	},
	// --- 5. GESUNDHEIT & PFLEGE (Health & Care Status) ---
	{
		id: "care_level_notice",
		titleKey: "docs.slots.care_level_notice",
		defaultTitle: "Pflegegradbescheid",
		badgeKey: "docs.badges.proof",
		defaultBadge: "Nachweis",
	},
	{
		id: "care_home_contract",
		titleKey: "docs.slots.care_home_contract",
		defaultTitle: "Heimvertrag",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "care_facility_costs",
		titleKey: "docs.slots.care_facility_costs",
		defaultTitle: "Heimkostenaufstellung / Übernahmeerklärung",
		badgeKey: "docs.badges.proof",
		defaultBadge: "Nachweis",
	},
	{
		id: "care_service_invoice",
		titleKey: "docs.slots.care_service_invoice",
		defaultTitle: "Rechnungen des ambulanten Pflegedienstes",
		badgeKey: "docs.badges.proof",
		defaultBadge: "Nachweis",
	},
	{
		id: "disability_id",
		titleKey: "docs.slots.disability_id",
		defaultTitle: "Schwerbehindertenausweis",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
];

/**
 * Subset of mandatory required documents for the MVP application journey.
 */
export const MVP_DOCUMENT_SLOTS: RequiredDocumentSlot[] = [
	{
		id: "id_card",
		titleKey: "docs.slots.id_card",
		defaultTitle: "Personalausweis oder Reisepass",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "health_insurance",
		titleKey: "docs.slots.health_insurance",
		defaultTitle: "Nachweis der Krankenversicherungsmitgliedschaft",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "pension_notice",
		titleKey: "docs.slots.pension_notice",
		defaultTitle: "Erstrentenbescheid",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "stmt3",
		titleKey: "docs.slots.stmt3",
		defaultTitle: "Kontoauszüge der letzten 3 Monate",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "rent",
		titleKey: "docs.slots.rent",
		defaultTitle: "Mietvertrag",
		badgeKey: "docs.badges.doc",
		defaultBadge: "Dokument",
	},
	{
		id: "heating",
		titleKey: "docs.slots.heating",
		defaultTitle: "Heizkostennachweis (Gas-/Wärmerechnung)",
		badgeKey: "docs.badges.proof",
		defaultBadge: "Nachweis",
	},
];

export interface DocumentGroup {
	id: string;
	titleKey: string;
	defaultTitle: string;
	descriptionKey: string;
	defaultDescription: string;
	slotIds: string[];
}

/**
 * Thematic grouping for document checklist slots.
 */
export const APPLICATION_DOCUMENT_GROUPS: DocumentGroup[] = [
	{
		id: "identity",
		titleKey: "docs.groups.identity",
		defaultTitle: "Identität und persönliche Dokumente",
		descriptionKey: "docs.group_descriptions.identity",
		defaultDescription:
			"Personalausweis, Reisepass, Meldebescheinigung, Krankenversicherung",
		slotIds: ["id_card", "registration", "health_insurance"],
	},
	{
		id: "income",
		titleKey: "docs.groups.income",
		defaultTitle: "Einkommen und Finanzen",
		descriptionKey: "docs.group_descriptions.income",
		defaultDescription:
			"Erstrentenbescheid, Kontoauszüge der letzten 3 Monate, Einkommenserklärung...",
		slotIds: ["pension_notice", "stmt3", "income", "assets", "bank"],
	},
	{
		id: "housing",
		titleKey: "docs.groups.housing",
		defaultTitle: "Wohnen und Wohnkosten",
		descriptionKey: "docs.group_descriptions.housing",
		defaultDescription:
			"Mietvertrag, Nebenkostenrechnung, Heizkostennachweis...",
		slotIds: ["rent", "utility_bill", "heating", "housing"],
	},
	{
		id: "declarations",
		titleKey: "docs.groups.declarations",
		defaultTitle: "Anträge und Erklärungen",
		descriptionKey: "docs.group_descriptions.declarations",
		defaultDescription:
			"Mitwirkungsverpflichtung, Datenschutzerklärung, Haushaltsangehörige...",
		slotIds: ["cooperation_agreement", "household"],
	},
	{
		id: "health",
		titleKey: "docs.groups.health",
		defaultTitle: "Gesundheit und Pflege",
		descriptionKey: "docs.group_descriptions.health",
		defaultDescription:
			"Pflegegradbescheid, Heimvertrag, Heimkosten, Schwerbehindertenausweis...",
		slotIds: [
			"care_level_notice",
			"care_home_contract",
			"care_facility_costs",
			"care_service_invoice",
			"disability_id",
		],
	},
];

export const MVP_SKIPPED_CATEGORIES: string[] = [];
