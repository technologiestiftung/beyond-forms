/**
 * Centralized manifest of i18n keys.
 */
export const i18nKeys = {
	common: {
		next: "next",
		back: "back",
		cancel: "cancel",
		confirm: "confirm",
	},
	aria: {
		welcome: "aria.welcome",
		questionnaire: "aria.questionnaire",
	},
	start: {
		title: "start_screen.title",
		desc: "start_screen.description",
		descList: "start_screen.description_list",
		cta: "start_screen.cta",
		introCards: {
			sectionTitle: "start_screen.intro_cards.section_title",
			title: (step: number) => `start_screen.intro_cards.${step}.title`,
			description: (step: number) =>
				`start_screen.intro_cards.${step}.description`,
			slideAria: "start_screen.intro_cards.slide_aria",
			dotAria: "start_screen.intro_cards.dot_aria",
			tapAdvance: "start_screen.intro_cards.tap_advance",
		},
	},
	eligibility: {
		title: "application_title",
		progressAria: "progress_aria",
		questionTitle: (key: string) => `questions.${key}.title`,
		questionTip: (key: string) => `questions.${key}.tip`,
		questionCategory: (key: string) => `questions.${key}.category`,
		dateTooEarly: "date_error.too_early",
		dateInFuture: "date_error.future",
	},
} as const;
