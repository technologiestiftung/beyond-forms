# Leistungscheck Teil C — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Ergebnis der Ersteinschätzung lesbar machen und die Antworten ins Profil übertragen, ohne dabei vorhandene Haushaltsdaten zu zerstören.

**Architecture:** Eine gestaltete Ergebnisansicht ersetzt die Übergangslösung aus Teil B: flache Liste in fester Reihenfolge, `NOT_APPLICABLE` gedämpft statt versteckt. Die Kinder wandern über eine reine Merge-Funktion nach `associated_persons`; gelesen wird über ein rohes `GET`, weil der Frontend-Profiltyp das Feld nicht führt.

**Tech Stack:** TypeScript, React 19, Vitest, @testing-library/react. Keine neuen Dependencies.

**Spec:** `docs/specs/2026-09-10-leistungscheck-teil-c-design.md`

## Global Constraints

- **Arbeitsverzeichnis für alle Kommandos:** `services/wallet-frontend`
- **Tests:** `npx vitest run <pfad>` für einzelne Dateien, `npm test` für die Suite
- **Baseline vor Task 1:** `Tests 1 failed | 414 passed (415)`. Der eine rote Test ist `src/views/Application/ApplicationOverview.test.tsx` und war schon vor Teil A rot. Er bleibt rot. **Nach jeder Task gilt: genau ein roter Test, und zwar dieser.**
- **Lint-Baseline:** vier Befunde (2 Fehler, 2 Warnungen) in `PersonalDataEdit.tsx` und `tests/fixtures/test-with-authenticated-user.ts`. Kein neuer.
- **Einrückung:** Tabs, nicht Spaces
- **Der globale i18n-Mock** in `src/tests/vitest.setup.ts` liefert `t: (key) => key` und **ignoriert Interpolation**. Tests dürfen deshalb nie auf übersetzten Text prüfen, sondern auf Schlüssel oder auf ARIA-Attribute.
- **Farbe nie allein:** jeder Status trägt zusätzlich Text. Nur `LIKELY_YES` bekommt ein Symbol.
- **Der Disclaimer wird unbedingt gerendert**, aus i18n, nie aus `BenefitCheckResult`.
- **Keine Anzeigetexte im Code.** Copy lebt in `src/locales/{de,en}/eligibility.json`.
- **Nicht aufräumen:** die toten Schlüssel `outcome/`, `start_screen.feature_cards`, `back_aria` und die sieben toten Einträge in `i18nKeys.ts` bleiben unangetastet — offene Entscheidung des Auftraggebers, eigener Commit.
- **Commit-Präfix:** Conventional Commits. Jeder Commit endet mit:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
- **Branch:** `ben-vibes` (bereits ausgecheckt)

---

## Dateistruktur

| Datei | Verantwortung | Task |
|---|---|---|
| `src/locales/{de,en}/eligibility.json` | **geändert** — neuer `result.*`-Block | 1 |
| `src/store/benefits/resultCopy.test.ts` | **neu** — Copy gegen die Enums | 1 |
| `src/components/Eligibility/BenefitAssessmentCard.tsx` | **neu** — eine Leistungskarte | 2 |
| `src/views/EligibilityResult.tsx` | **ersetzt** — die gestaltete Ansicht | 3 |
| `src/services/associatedPersons.ts` | **neu** — `mergeChildren`, reine Funktion | 4 |
| `src/services/application.service.ts` | **geändert** — `GET`, Merge, Fallback | 5 |

---

## Task 1: Copy

**Files:**
- Modify: `src/locales/de/eligibility.json`
- Modify: `src/locales/en/eligibility.json`
- Test: `src/store/benefits/resultCopy.test.ts`

**Interfaces:**
- Consumes: `BenefitId`, `BenefitStatus`, `ReasonCode`, `HintCode` aus `src/schemas/benefitCheck.schema.ts`
- Produces: i18n-Schlüssel `result.title`, `result.cta`, `result.disclaimer`, `result.referral.{title,description,link}`, `result.benefit.<BenefitId>`, `result.status.<BenefitStatus>`, `result.reason.<ReasonCode>`, `result.hint.<HintCode>`

- [ ] **Step 1: Write the failing test**

`src/store/benefits/resultCopy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import de from "../../locales/de/eligibility.json";
import en from "../../locales/en/eligibility.json";
import {
	BenefitId,
	BenefitStatus,
	HintCode,
	ReasonCode,
} from "../../schemas/benefitCheck.schema";

const LOCALES = { de, en } as Record<string, Record<string, unknown>>;

const resultOf = (locale: string): Record<string, Record<string, string>> =>
	LOCALES[locale].result as Record<string, Record<string, string>>;

describe.each(["de", "en"])("result copy (%s)", (locale) => {
	const result = resultOf(locale);

	it("has the frame texts", () => {
		for (const key of ["title", "cta", "disclaimer"]) {
			expect(typeof result[key], key).toBe("string");
			expect((result[key] as unknown as string).length, key).toBeGreaterThan(0);
		}
		for (const key of ["title", "description", "link"]) {
			expect(typeof result.referral[key], `referral.${key}`).toBe("string");
		}
	});

	it("names every benefit", () => {
		for (const id of Object.values(BenefitId)) {
			expect(typeof result.benefit[id], `benefit.${id}`).toBe("string");
		}
	});

	it("labels every status", () => {
		for (const status of Object.values(BenefitStatus)) {
			expect(typeof result.status[status], `status.${status}`).toBe("string");
		}
	});

	it("explains every reason code", () => {
		for (const code of Object.values(ReasonCode)) {
			expect(typeof result.reason[code], `reason.${code}`).toBe("string");
		}
	});

	it("explains every hint code", () => {
		for (const code of Object.values(HintCode)) {
			expect(typeof result.hint[code], `hint.${code}`).toBe("string");
		}
	});

	it("carries no copy for codes that no longer exist", () => {
		const known = {
			benefit: new Set<string>(Object.values(BenefitId)),
			status: new Set<string>(Object.values(BenefitStatus)),
			reason: new Set<string>(Object.values(ReasonCode)),
			hint: new Set<string>(Object.values(HintCode)),
		};
		for (const [group, allowed] of Object.entries(known)) {
			for (const key of Object.keys(result[group])) {
				expect(allowed.has(key), `stale ${group}.${key}`).toBe(true);
			}
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/resultCopy.test.ts`
Expected: FAIL — `result` ist in beiden Locale-Dateien noch nicht vorhanden.

- [ ] **Step 3: Deutsche Copy schreiben**

In `src/locales/de/eligibility.json` **nach** dem `questions`-Block einfügen:

```json
	"result": {
		"title": "Deine Ersteinschätzung",
		"cta": "Konto erstellen und weitermachen",
		"disclaimer": "Das ist eine automatische Ersteinschätzung ohne Rechtsverbindlichkeit. Sie ersetzt keine Beratung durch Jobcenter, Sozialamt oder eine unabhängige Sozialberatung.",
		"referral": {
			"title": "Im Moment passt keine der geprüften Leistungen",
			"description": "Das heißt nicht, dass es keine Unterstützung für Dich gibt. Das Sozialamt in Deinem Bezirk kann Dir sagen, was für Deine Situation infrage kommt.",
			"link": "Sozialamt in Deinem Bezirk finden"
		},
		"benefit": {
			"SGB_II_BASIC_INCOME": "Grundsicherungsgeld",
			"SGB_XII_OLD_AGE_REDUCED_CAPACITY": "Grundsicherung im Alter und bei Erwerbsminderung",
			"SGB_XII_SUBSISTENCE_AID": "Hilfe zum Lebensunterhalt",
			"HOUSING_BENEFIT": "Wohngeld",
			"CHILD_SUPPLEMENT": "Kinderzuschlag",
			"ADVANCE_MAINTENANCE": "Unterhaltsvorschuss"
		},
		"status": {
			"LIKELY_YES": "Das lohnt sich",
			"CHECK_ADVISED": "Das solltest Du prüfen lassen",
			"LIKELY_NO": "Trifft bei Dir vermutlich nicht zu",
			"NOT_APPLICABLE": "Betrifft Deine Situation nicht"
		},
		"reason": {
			"INSUFFICIENT_DATA": "Dazu fehlen noch Angaben.",
			"RETIREMENT_AGE_REACHED": "Du hast die Regelaltersgrenze erreicht.",
			"RETIREMENT_AGE_NOT_REACHED": "Du hast die Regelaltersgrenze noch nicht erreicht.",
			"WORK_CAPACITY_NOT_FULL": "Du kannst nicht mindestens drei Stunden am Tag arbeiten.",
			"NOT_IN_CAPACITY_GAP": "Diese Leistung gilt nur, wenn Du vorübergehend nicht arbeiten kannst.",
			"RESIDENCE_STATUS_UNCLEAR": "Dein Aufenthaltsstatus muss im Einzelfall geprüft werden.",
			"ALREADY_RECEIVING_BENEFITS": "Du bekommst laut Deinen Angaben schon eine vergleichbare Leistung.",
			"BENEFITS_TAKE_PRECEDENCE": "Wer schon eine Grundsicherung bekommt, kann diese Leistung meist nicht zusätzlich bekommen.",
			"INCOME_BELOW_NEEDS": "Dein Einkommen deckt den geschätzten Bedarf nicht.",
			"INCOME_COVERS_NEEDS": "Dein Einkommen deckt den geschätzten Bedarf.",
			"INCOME_BELOW_SUBSISTENCE": "Dein Einkommen reicht nicht einmal ohne Miete zum Leben. Dann kommt eher eine Grundsicherung infrage.",
			"ASSETS_BELOW_ALLOWANCE": "Deine Ersparnisse liegen unter dem Freibetrag.",
			"ASSETS_SPAN_ALLOWANCE": "Deine Ersparnisse liegen im Bereich des Freibetrags. Der genaue Betrag entscheidet.",
			"ASSETS_ABOVE_ALLOWANCE": "Deine Ersparnisse liegen über dem Freibetrag.",
			"RENT_BURDEN_HIGH": "Deine Miete ist im Verhältnis zu Deinem Einkommen hoch.",
			"RENT_BURDEN_NORMAL": "Deine Miete ist im Verhältnis zu Deinem Einkommen unauffällig.",
			"NO_ELIGIBLE_CHILDREN": "In Deinem Haushalt leben keine Kinder, für die diese Leistung gilt.",
			"KIZ_MIN_INCOME_MET": "Dein Bruttoeinkommen erreicht die Mindestgrenze.",
			"KIZ_MIN_INCOME_NOT_MET": "Dein Bruttoeinkommen erreicht die Mindestgrenze nicht. Dann kommt eher Grundsicherungsgeld für die Kinder infrage.",
			"NOT_SINGLE_PARENT": "Diese Leistung gibt es nur für Alleinerziehende.",
			"NO_MINOR_CHILDREN": "In Deinem Haushalt lebt kein Kind unter 18 Jahren.",
			"CHILD_RECEIVES_FULL_SUPPORT": "Dein Kind bekommt den vollen Unterhalt.",
			"CHILD_SUPPORT_INCOMPLETE": "Dein Kind bekommt keinen oder zu wenig Unterhalt.",
			"EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA": "Wie viel es genau wäre, kann nur die zuständige Stelle berechnen.",
			"CAPACITY_GAP_PRECONDITION_MET": "Die Grundvoraussetzung ist erfüllt. Einkommen und Ersparnisse muss die zuständige Stelle prüfen."
		},
		"hint": {
			"EDUCATION_PARTICIPATION_PACKAGE": "Bildungs- und Teilhabepaket: Wenn Du eine dieser Leistungen bekommst, haben Deine Kinder meist automatisch Anspruch auf Zuschüsse für Schule, Sport und Musik.",
			"CHILD_BENEFIT_PREREQUISITE": "Kindergeld ist Voraussetzung für den Kinderzuschlag. Falls Du es noch nicht beantragt hast, fang dort an.",
			"ASYLUM_BENEFITS_REFERRAL": "Ist Dein Aufenthalt noch nicht gesichert, gelten für Dich möglicherweise Asylbewerberleistungen statt der hier geprüften. Eine Beratungsstelle kann Dir sagen, was für Dich gilt."
		}
	},
```

- [ ] **Step 4: Englische Copy schreiben**

In `src/locales/en/eligibility.json` an derselben Stelle:

```json
	"result": {
		"title": "Your initial assessment",
		"cta": "Create an account and continue",
		"disclaimer": "This is an automated initial assessment with no legal force. It does not replace advice from a Jobcenter, a Sozialamt or an independent advice service.",
		"referral": {
			"title": "None of the benefits checked here fit at the moment",
			"description": "That does not mean there is no support for you. The Sozialamt in your district can tell you what might apply to your situation.",
			"link": "Find the Sozialamt in your district"
		},
		"benefit": {
			"SGB_II_BASIC_INCOME": "Grundsicherungsgeld",
			"SGB_XII_OLD_AGE_REDUCED_CAPACITY": "Grundsicherung in old age and on reduced earning capacity",
			"SGB_XII_SUBSISTENCE_AID": "Hilfe zum Lebensunterhalt",
			"HOUSING_BENEFIT": "Wohngeld (housing benefit)",
			"CHILD_SUPPLEMENT": "Kinderzuschlag (child supplement)",
			"ADVANCE_MAINTENANCE": "Unterhaltsvorschuss (advance maintenance)"
		},
		"status": {
			"LIKELY_YES": "Worth applying for",
			"CHECK_ADVISED": "Worth having checked",
			"LIKELY_NO": "Probably does not apply to you",
			"NOT_APPLICABLE": "Does not concern your situation"
		},
		"reason": {
			"INSUFFICIENT_DATA": "Some answers are still missing for this.",
			"RETIREMENT_AGE_REACHED": "You have reached the statutory retirement age.",
			"RETIREMENT_AGE_NOT_REACHED": "You have not yet reached the statutory retirement age.",
			"WORK_CAPACITY_NOT_FULL": "You cannot work at least three hours a day.",
			"NOT_IN_CAPACITY_GAP": "This benefit only applies if you are temporarily unable to work.",
			"RESIDENCE_STATUS_UNCLEAR": "Your residence status needs to be assessed individually.",
			"ALREADY_RECEIVING_BENEFITS": "According to your answers you already receive a comparable benefit.",
			"BENEFITS_TAKE_PRECEDENCE": "If you already receive a Grundsicherung, you usually cannot receive this benefit on top.",
			"INCOME_BELOW_NEEDS": "Your income does not cover the estimated need.",
			"INCOME_COVERS_NEEDS": "Your income covers the estimated need.",
			"INCOME_BELOW_SUBSISTENCE": "Your income is not enough to live on even before rent. A Grundsicherung is the more likely fit.",
			"ASSETS_BELOW_ALLOWANCE": "Your savings are below the allowance.",
			"ASSETS_SPAN_ALLOWANCE": "Your savings are around the allowance. The exact amount decides.",
			"ASSETS_ABOVE_ALLOWANCE": "Your savings are above the allowance.",
			"RENT_BURDEN_HIGH": "Your rent is high relative to your income.",
			"RENT_BURDEN_NORMAL": "Your rent is unremarkable relative to your income.",
			"NO_ELIGIBLE_CHILDREN": "There are no children in your household this benefit applies to.",
			"KIZ_MIN_INCOME_MET": "Your gross income reaches the minimum threshold.",
			"KIZ_MIN_INCOME_NOT_MET": "Your gross income does not reach the minimum threshold. Grundsicherungsgeld for the children is the more likely fit.",
			"NOT_SINGLE_PARENT": "This benefit exists only for single parents.",
			"NO_MINOR_CHILDREN": "There is no child under 18 in your household.",
			"CHILD_RECEIVES_FULL_SUPPORT": "Your child receives full maintenance.",
			"CHILD_SUPPORT_INCOMPLETE": "Your child receives no maintenance, or too little.",
			"EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA": "Only the responsible office can work out the exact amount.",
			"CAPACITY_GAP_PRECONDITION_MET": "The basic precondition is met. The responsible office has to assess income and savings."
		},
		"hint": {
			"EDUCATION_PARTICIPATION_PACKAGE": "Bildungs- und Teilhabepaket: if you receive one of these benefits, your children are usually automatically entitled to support for school, sport and music.",
			"CHILD_BENEFIT_PREREQUISITE": "Kindergeld is a prerequisite for the Kinderzuschlag. If you have not applied for it yet, start there.",
			"ASYLUM_BENEFITS_REFERRAL": "If your residence is not yet secure, Asylbewerberleistungen may apply to you rather than the benefits checked here. An advice service can tell you what applies."
		}
	},
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/resultCopy.test.ts`
Expected: PASS — 12 Tests (6 pro Sprache)

Run: `python3 -c "import json;[json.load(open(f'src/locales/{l}/eligibility.json')) for l in ('de','en')];print('JSON ok')"`
Expected: `JSON ok`

- [ ] **Step 6: Commit**

```bash
git add src/locales/de/eligibility.json src/locales/en/eligibility.json src/store/benefits/resultCopy.test.ts
git commit -m "$(cat <<'EOF'
feat: add copy for the benefit check result

Names for the six benefits, the four status labels from the domain spec's
section 8, all twenty-five reason codes and the three hints, in both languages.

A test compares the copy against the enums in benefitCheck.schema.ts, so a code
without text fails the suite instead of showing a raw key to someone applying for
benefits. It also fails on stale entries.

The copy is a proposal and needs human review before it reaches users.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: BenefitAssessmentCard

**Files:**
- Create: `src/components/Eligibility/BenefitAssessmentCard.tsx`
- Test: `src/components/Eligibility/BenefitAssessmentCard.test.tsx`

**Interfaces:**
- Consumes: `BenefitAssessment`, `BenefitStatus`, `BenefitId`, `ReasonCode` (Teil A); Copy (Task 1)
- Produces: `BenefitAssessmentCard` mit Prop `{ assessment: BenefitAssessment }`

- [ ] **Step 1: Write the failing test**

`src/components/Eligibility/BenefitAssessmentCard.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BenefitAssessmentCard } from "./BenefitAssessmentCard";
import {
	BenefitId,
	BenefitStatus,
	ReasonCode,
} from "../../schemas/benefitCheck.schema";

describe("BenefitAssessmentCard", () => {
	it("names the benefit, the status and every reason", () => {
		render(
			<BenefitAssessmentCard
				assessment={{
					benefit: BenefitId.HOUSING_BENEFIT,
					status: BenefitStatus.CHECK_ADVISED,
					reasons: [
						ReasonCode.RENT_BURDEN_HIGH,
						ReasonCode.EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA,
					],
				}}
			/>,
		);
		// The global i18n mock returns keys, so these assert the lookups happen.
		expect(screen.getByText("result.benefit.HOUSING_BENEFIT")).toBeInTheDocument();
		expect(
			screen.getByText("result.status.CHECK_ADVISED"),
		).toBeInTheDocument();
		expect(
			screen.getByText("result.reason.RENT_BURDEN_HIGH"),
		).toBeInTheDocument();
		expect(
			screen.getByText("result.reason.EXACT_AMOUNT_NEEDS_OFFICIAL_FORMULA"),
		).toBeInTheDocument();
	});

	it("marks a likely benefit with an icon", () => {
		render(
			<BenefitAssessmentCard
				assessment={{
					benefit: BenefitId.ADVANCE_MAINTENANCE,
					status: BenefitStatus.LIKELY_YES,
					reasons: [ReasonCode.CHILD_SUPPORT_INCOMPLETE],
				}}
			/>,
		);
		expect(screen.getByTestId("status-icon")).toBeInTheDocument();
	});

	it("gives no icon to any other status", () => {
		for (const status of [
			BenefitStatus.CHECK_ADVISED,
			BenefitStatus.LIKELY_NO,
			BenefitStatus.NOT_APPLICABLE,
		]) {
			const { unmount } = render(
				<BenefitAssessmentCard
					assessment={{
						benefit: BenefitId.HOUSING_BENEFIT,
						status,
						reasons: [],
					}}
				/>,
			);
			expect(screen.queryByTestId("status-icon"), status).toBeNull();
			unmount();
		}
	});

	it("mutes a benefit that does not concern the applicant", () => {
		render(
			<BenefitAssessmentCard
				assessment={{
					benefit: BenefitId.SGB_XII_SUBSISTENCE_AID,
					status: BenefitStatus.NOT_APPLICABLE,
					reasons: [ReasonCode.NOT_IN_CAPACITY_GAP],
				}}
			/>,
		);
		expect(
			screen.getByTestId("assessment-SGB_XII_SUBSISTENCE_AID"),
		).toHaveAttribute("data-muted", "true");
	});

	it("does not mute the other statuses", () => {
		render(
			<BenefitAssessmentCard
				assessment={{
					benefit: BenefitId.SGB_II_BASIC_INCOME,
					status: BenefitStatus.LIKELY_NO,
					reasons: [ReasonCode.INCOME_COVERS_NEEDS],
				}}
			/>,
		);
		expect(
			screen.getByTestId("assessment-SGB_II_BASIC_INCOME"),
		).toHaveAttribute("data-muted", "false");
	});

	it("still names the status when there are no reasons", () => {
		render(
			<BenefitAssessmentCard
				assessment={{
					benefit: BenefitId.CHILD_SUPPLEMENT,
					status: BenefitStatus.LIKELY_NO,
					reasons: [],
				}}
			/>,
		);
		expect(screen.getByText("result.status.LIKELY_NO")).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Eligibility/BenefitAssessmentCard.test.tsx`
Expected: FAIL — `Failed to resolve import "./BenefitAssessmentCard"`

- [ ] **Step 3: Write minimal implementation**

`src/components/Eligibility/BenefitAssessmentCard.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { BenefitStatus } from "../../schemas/benefitCheck.schema";
import type { BenefitAssessment } from "../../schemas/benefitCheck.schema";
import { CheckCircleIcon } from "../ui/Icons";

interface BenefitAssessmentCardProps {
	assessment: BenefitAssessment;
}

/**
 * Colour is always paired with the status text, never used on its own — otherwise the
 * status is invisible to a screen reader and to colour-blind readers.
 */
const STATUS_TONE: Record<BenefitStatus, string> = {
	[BenefitStatus.LIKELY_YES]: "text-primary-blue-500",
	[BenefitStatus.CHECK_ADVISED]: "text-secondary-orange-500",
	[BenefitStatus.LIKELY_NO]: "text-brand-grey",
	[BenefitStatus.NOT_APPLICABLE]: "text-brand-grey",
};

export const BenefitAssessmentCard: React.FC<BenefitAssessmentCardProps> = ({
	assessment,
}) => {
	const { t } = useTranslation();
	/**
	 * Domain spec §8: a benefit that does not concern this household must not read as a
	 * rejection. It stays visible and legible but recedes.
	 */
	const isMuted = assessment.status === BenefitStatus.NOT_APPLICABLE;

	return (
		<li
			data-testid={`assessment-${assessment.benefit}`}
			data-muted={String(isMuted)}
			className={`w-full rounded-xl border border-brand-border-subtle bg-white p-4 shadow-cards ${
				isMuted ? "opacity-60" : ""
			}`}
		>
			<div className="flex items-start justify-between gap-3">
				<p className="text-body-lg font-semibold text-brand-black wrap-break-word">
					{t(`result.benefit.${assessment.benefit}`)}
				</p>
				{assessment.status === BenefitStatus.LIKELY_YES && (
					<CheckCircleIcon
						data-testid="status-icon"
						className="size-5 shrink-0 text-primary-blue-500"
					/>
				)}
			</div>

			<p
				className={`mt-1 text-base font-semibold ${STATUS_TONE[assessment.status]}`}
			>
				{t(`result.status.${assessment.status}`)}
			</p>

			{assessment.reasons.length > 0 && (
				<ul className="mt-2 flex flex-col gap-1 list-none p-0">
					{assessment.reasons.map((reason) => (
						<li key={reason} className="text-sm text-brand-grey">
							{t(`result.reason.${reason}`)}
						</li>
					))}
				</ul>
			)}
		</li>
	);
};
```

Falls `CheckCircleIcon` das `data-testid`-Prop nicht durchreicht, den Test-Anker auf einen
umschließenden `<span data-testid="status-icon">` legen statt das Icon zu ändern.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Eligibility/BenefitAssessmentCard.test.tsx`
Expected: PASS — 6 Tests

- [ ] **Step 5: Commit**

```bash
git add src/components/Eligibility/BenefitAssessmentCard.tsx src/components/Eligibility/BenefitAssessmentCard.test.tsx
git commit -m "$(cat <<'EOF'
feat: add BenefitAssessmentCard

One card per benefit, following the pattern of DocumentStatusListItem. Colour is
always paired with the status text and only a likely benefit gets an icon, so the
status survives a screen reader and colour blindness.

NOT_APPLICABLE recedes rather than disappearing. The domain spec asks that it not
read as a rejection, and with a flat list that de-emphasis is what stops several
non-matches from burying the one hit.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Ergebnisansicht

**Files:**
- Modify: `src/views/EligibilityResult.tsx` (ersetzt die Übergangslösung vollständig)
- Test: `src/views/EligibilityResult.test.tsx`

**Interfaces:**
- Consumes: `BenefitAssessmentCard` (Task 2); Copy (Task 1); `evaluateBenefitCheck` (Teil A); `useBenefitCheckStore` (Teil B); `EXTERNAL_LINKS`
- Produces: nichts für spätere Tasks

- [ ] **Step 1: Write the failing test**

`src/views/EligibilityResult.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EligibilityResult } from "./EligibilityResult";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import {
	AssetsBand,
	BenefitId,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../schemas/benefitCheck.schema";
import type { PartialBenefitCheckAnswers } from "../schemas/benefitCheck.schema";

/** Case C from the domain spec: single parent, one child, no maintenance. */
const CASE_C: PartialBenefitCheckAnswers = {
	householdComposition: HouseholdComposition.SINGLE_PARENT,
	children: [{ dateOfBirth: "2020-02-11" }],
	dateOfBirth: "1997-05-02",
	livesInGermany: true,
	workCapacity: WorkCapacity.FULL,
	isEmployed: true,
	monthlyGrossIncome: 1400,
	monthlyNetHouseholdIncome: 1900,
	monthlyWarmRent: 700,
	assetsBand: AssetsBand.UNDER_5000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
	childReceivesFullSupport: false,
	monthsWithoutChildSupport: 8,
};

/** A comfortable single: nothing matches, so the referral must appear. */
const NO_MATCH: PartialBenefitCheckAnswers = {
	householdComposition: HouseholdComposition.SINGLE,
	children: [],
	dateOfBirth: "1994-01-15",
	livesInGermany: true,
	workCapacity: WorkCapacity.FULL,
	isEmployed: true,
	monthlyGrossIncome: 5000,
	monthlyNetHouseholdIncome: 4000,
	monthlyWarmRent: 700,
	assetsBand: AssetsBand.OVER_25000,
	receivesBenefitsAlready: false,
	citizenship: Citizenship.DE_EU,
};

const renderResult = () =>
	render(
		<MemoryRouter>
			<EligibilityResult />
		</MemoryRouter>,
	);

const seed = (answers: PartialBenefitCheckAnswers) => {
	const store = useBenefitCheckStore.getState();
	for (const [field, value] of Object.entries(answers)) {
		store.setAnswer(
			field as never,
			value as never,
		);
	}
};

describe("EligibilityResult", () => {
	beforeEach(() => {
		useBenefitCheckStore.getState().resetForm();
	});

	// Read the ids with getAttribute, not element.dataset — jsdom does not populate
	// dataset for a hyphenated attribute set through React the way a browser does.
	it("renders one card per benefit, in the engine's order", () => {
		seed(CASE_C);
		renderResult();
		const ids = screen
			.getAllByTestId(/^assessment-/)
			.map((card) => card.getAttribute("data-testid"));
		expect(ids).toEqual([
			`assessment-${BenefitId.SGB_II_BASIC_INCOME}`,
			`assessment-${BenefitId.SGB_XII_OLD_AGE_REDUCED_CAPACITY}`,
			`assessment-${BenefitId.SGB_XII_SUBSISTENCE_AID}`,
			`assessment-${BenefitId.HOUSING_BENEFIT}`,
			`assessment-${BenefitId.CHILD_SUPPLEMENT}`,
			`assessment-${BenefitId.ADVANCE_MAINTENANCE}`,
		]);
	});

	it("always renders the disclaimer", () => {
		seed(CASE_C);
		renderResult();
		expect(screen.getByTestId("result-disclaimer")).toBeInTheDocument();
	});

	it("renders the disclaimer even with no answers at all", () => {
		renderResult();
		expect(screen.getByTestId("result-disclaimer")).toBeInTheDocument();
	});

	it("shows the hints the engine produced", () => {
		seed(CASE_C);
		renderResult();
		expect(screen.getByTestId("result-hints")).toBeInTheDocument();
	});

	it("omits the hint list when there are none", () => {
		seed(NO_MATCH);
		renderResult();
		expect(screen.queryByTestId("result-hints")).toBeNull();
	});

	it("offers the referral when nothing matches", () => {
		seed(NO_MATCH);
		renderResult();
		const referral = screen.getByTestId("result-referral");
		expect(referral).toBeInTheDocument();
		expect(
			referral.querySelector("a")?.getAttribute("href"),
		).toContain("service.berlin.de");
	});

	it("hides the referral as soon as one benefit is live", () => {
		seed(CASE_C);
		renderResult();
		expect(screen.queryByTestId("result-referral")).toBeNull();
	});

	it("links the continue button so the guest sync will fire", () => {
		seed(CASE_C);
		renderResult();
		expect(screen.getByTestId("result-cta")).toHaveAttribute(
			"href",
			"/profile?origin=eligibility",
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/EligibilityResult.test.tsx`
Expected: FAIL — die Übergangsansicht kennt weder `result-disclaimer` noch
`result-referral` noch `result-cta`.

- [ ] **Step 3: Write minimal implementation**

`src/views/EligibilityResult.tsx` vollständig ersetzen:

```tsx
import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { StepLayout } from "../components/Layout/StepLayout";
import { BenefitAssessmentCard } from "../components/Eligibility/BenefitAssessmentCard";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import { evaluateBenefitCheck } from "../store/benefits/evaluate";
import { BenefitStatus } from "../schemas/benefitCheck.schema";
import { AppRoutes, URL_PARAMS } from "../constants/routes";
import { EXTERNAL_LINKS } from "../config/externalLinks";

/**
 * ProtectedRoute forwards an unauthenticated visitor to Auth and keeps the query string,
 * so this is what makes AuthView run the guest sync. Changing the target silently turns
 * the transfer off.
 */
const CONTINUE_PATH = `${AppRoutes.Profile}?${URL_PARAMS.ORIGIN}=${URL_PARAMS.ORIGIN_ELIGIBILITY}`;

export const EligibilityResult: React.FC = () => {
	const { t } = useTranslation();
	const answers = useBenefitCheckStore((s) => s.answers);
	// Input-side clock only; the engine takes `today` as an argument so it stays testable.
	const today = new Date().toLocaleDateString("sv-SE");
	const result = evaluateBenefitCheck(answers, today);

	const nothingMatches = !result.assessments.some(
		(assessment) =>
			assessment.status === BenefitStatus.LIKELY_YES ||
			assessment.status === BenefitStatus.CHECK_ADVISED,
	);

	return (
		<StepLayout>
			<div className="w-full font-sans flex flex-col gap-6">
				<h1 className="text-h1 font-bold text-brand-black leading-tight">
					{t("result.title")}
				</h1>

				<ul className="flex flex-col gap-3 list-none p-0 m-0">
					{result.assessments.map((assessment) => (
						<BenefitAssessmentCard
							key={assessment.benefit}
							assessment={assessment}
						/>
					))}
				</ul>

				{nothingMatches && (
					<div
						data-testid="result-referral"
						className="rounded-xl border border-brand-border-subtle bg-brand-bg p-4"
					>
						<p className="font-semibold text-brand-black">
							{t("result.referral.title")}
						</p>
						<p className="mt-1 text-base text-brand-grey">
							{t("result.referral.description")}
						</p>
						<a
							href={EXTERNAL_LINKS.SOZIALAMT}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-2 inline-block text-base font-medium text-primary-blue-400 underline"
						>
							{t("result.referral.link")}
						</a>
					</div>
				)}

				{result.hints.length > 0 && (
					<ul
						data-testid="result-hints"
						className="flex flex-col gap-2 list-none p-0 m-0"
					>
						{result.hints.map((hint) => (
							<li key={hint} className="text-sm text-brand-grey">
								{t(`result.hint.${hint}`)}
							</li>
						))}
					</ul>
				)}

				<Link
					to={CONTINUE_PATH}
					data-testid="result-cta"
					className="w-full rounded-full bg-primary-blue-500 px-6 py-3 text-center font-bold text-white"
				>
					{t("result.cta")}
				</Link>

				<p
					data-testid="result-disclaimer"
					className="text-xs text-brand-grey leading-relaxed"
				>
					{t("result.disclaimer")}
				</p>
			</div>
		</StepLayout>
	);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/EligibilityResult.test.tsx`
Expected: PASS — 8 Tests

- [ ] **Step 5: Commit**

```bash
git add src/views/EligibilityResult.tsx src/views/EligibilityResult.test.tsx
git commit -m "$(cat <<'EOF'
feat: add the designed benefit check result view

Replaces the placeholder from part B. Flat list in the engine's own order, one
card per benefit, hints and disclaimer below.

The disclaimer is read from i18n and rendered unconditionally, so it cannot go
missing because the engine failed to attach it — a test covers the empty answer
set for exactly that reason.

When nothing is likely or worth checking, a referral to the district Sozialamt
appears. That case is the one the old check handled with its sozialamt outcome,
and without it the people with no match would be left with six rejections and no
next step.

The continue link keeps /profile?origin=eligibility. ProtectedRoute forwards an
unauthenticated visitor to Auth and preserves the query string, which is what
makes the guest sync run at all.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: mergeChildren

**Files:**
- Create: `src/services/associatedPersons.ts`
- Test: `src/services/associatedPersons.test.ts`

**Interfaces:**
- Consumes: `ChildEntry` (Teil B)
- Produces: `AssociatedPersonRow`, `mergeChildren(existing: AssociatedPersonRow[], children: ChildEntry[]): AssociatedPersonRow[]`

- [ ] **Step 1: Write the failing test**

`src/services/associatedPersons.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mergeChildren } from "./associatedPersons";
import type { AssociatedPersonRow } from "./associatedPersons";

const spouse: AssociatedPersonRow = {
	association_type: "Spouse",
	lives_in_household: true,
	sort_order: 0,
	first_name: "Ingrid",
	date_of_birth: "1957-08-14",
};

const child = (
	dateOfBirth: string,
	firstName?: string,
): AssociatedPersonRow => ({
	association_type: "Child",
	lives_in_household: true,
	sort_order: 0,
	date_of_birth: dateOfBirth,
	...(firstName ? { first_name: firstName } : {}),
});

describe("mergeChildren", () => {
	it("creates rows when the collection is empty", () => {
		const merged = mergeChildren([], [{ dateOfBirth: "2020-02-11" }]);
		expect(merged).toEqual([
			{
				association_type: "Child",
				lives_in_household: true,
				sort_order: 0,
				date_of_birth: "2020-02-11",
			},
		]);
	});

	it("leaves a spouse untouched and appends the child after them", () => {
		const merged = mergeChildren([spouse], [{ dateOfBirth: "2020-02-11" }]);
		expect(merged).toHaveLength(2);
		expect(merged[0].first_name).toBe("Ingrid");
		expect(merged[0].association_type).toBe("Spouse");
		expect(merged[1].association_type).toBe("Child");
	});

	it("keeps an existing child's name when the date of birth matches", () => {
		const merged = mergeChildren(
			[child("2020-02-11", "Mia")],
			[{ dateOfBirth: "2020-02-11" }],
		);
		expect(merged).toHaveLength(1);
		expect(merged[0].first_name).toBe("Mia");
	});

	it("drops a child the applicant no longer names", () => {
		const merged = mergeChildren(
			[child("2020-02-11", "Mia"), child("2015-03-01", "Jonas")],
			[{ dateOfBirth: "2020-02-11" }],
		);
		expect(merged).toHaveLength(1);
		expect(merged[0].first_name).toBe("Mia");
	});

	it("keeps non-child rows even when every child is dropped", () => {
		const merged = mergeChildren([spouse, child("2015-03-01")], []);
		expect(merged).toHaveLength(1);
		expect(merged[0].association_type).toBe("Spouse");
	});

	it("preserves the order of the rows it keeps", () => {
		const merged = mergeChildren(
			[child("2020-02-11", "Mia"), spouse],
			[{ dateOfBirth: "2020-02-11" }, { dateOfBirth: "2023-07-01" }],
		);
		expect(merged.map((row) => row.association_type)).toEqual([
			"Child",
			"Spouse",
			"Child",
		]);
		expect(merged[0].first_name).toBe("Mia");
		expect(merged[2].date_of_birth).toBe("2023-07-01");
	});

	it("renumbers sort_order without gaps", () => {
		const merged = mergeChildren(
			[spouse],
			[{ dateOfBirth: "2020-02-11" }, { dateOfBirth: "2023-07-01" }],
		);
		expect(merged.map((row) => row.sort_order)).toEqual([0, 1, 2]);
	});

	it("matches two children with the same date of birth to two rows", () => {
		const merged = mergeChildren(
			[child("2020-02-11", "Mia"), child("2020-02-11", "Tom")],
			[{ dateOfBirth: "2020-02-11" }, { dateOfBirth: "2020-02-11" }],
		);
		expect(merged).toHaveLength(2);
		expect(merged.map((row) => row.first_name)).toEqual(["Mia", "Tom"]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/associatedPersons.test.ts`
Expected: FAIL — `Failed to resolve import "./associatedPersons"`

- [ ] **Step 3: Write minimal implementation**

`src/services/associatedPersons.ts`:

```ts
import type { ChildEntry } from "../schemas/benefitCheck.schema";

/**
 * One row of the profile's `associated_persons`, as `GET /profile` returns it. Typed
 * loosely on purpose: the frontend's Profile schema does not carry this collection, and
 * only the fields this merge reasons about are named.
 */
export interface AssociatedPersonRow {
	association_type: string;
	lives_in_household?: boolean;
	sort_order?: number;
	date_of_birth?: string | null;
	[key: string]: unknown;
}

const CHILD = "Child";

/**
 * Folds the questionnaire's children into an existing collection.
 *
 * POST /profile replaces `associated_persons` wholesale — the writer in user_service.py
 * says so explicitly, so that the PDFs' fixed person slots do not shift. Sending only
 * the children would therefore delete a partner the chat assistant had recorded.
 *
 * Rules:
 *   - non-child rows are kept, in their original order
 *   - a child row whose date of birth the applicant named again is kept, so a name
 *     recorded elsewhere survives
 *   - children with no matching row are appended
 *   - child rows the applicant did not name again are dropped: they just told us who
 *     lives in the household
 *   - sort_order is renumbered by position, mirroring what the server does, so the
 *     payload is self-consistent
 */
export const mergeChildren = (
	existing: AssociatedPersonRow[],
	children: ChildEntry[],
): AssociatedPersonRow[] => {
	const unclaimed = children.map((entry) => entry.dateOfBirth);
	const kept: AssociatedPersonRow[] = [];

	for (const row of existing) {
		if (row.association_type !== CHILD) {
			kept.push(row);
			continue;
		}
		const match = unclaimed.indexOf(row.date_of_birth ?? "");
		if (match !== -1) {
			unclaimed.splice(match, 1);
			kept.push(row);
		}
	}

	for (const dateOfBirth of unclaimed) {
		kept.push({
			association_type: CHILD,
			lives_in_household: true,
			sort_order: 0,
			date_of_birth: dateOfBirth,
		});
	}

	return kept.map((row, index) => ({ ...row, sort_order: index }));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/associatedPersons.test.ts`
Expected: PASS — 8 Tests

- [ ] **Step 5: Commit**

```bash
git add src/services/associatedPersons.ts src/services/associatedPersons.test.ts
git commit -m "$(cat <<'EOF'
feat: add the associated_persons merge for the questionnaire's children

POST /profile replaces the collection wholesale, so a sync carrying only children
would delete a partner the chat assistant had recorded.

Non-child rows keep their place. Child rows are matched by date of birth, so a
name recorded elsewhere survives; unmatched children are appended and child rows
the applicant did not name again are dropped, since they have just said who lives
in the household. sort_order is renumbered by position, mirroring the server, so
the payload is self-consistent and the PDFs' person slots stay put.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Sync verdrahten

**Files:**
- Modify: `src/services/application.service.ts`
- Modify: `src/services/application.service.test.ts`

**Interfaces:**
- Consumes: `mergeChildren`, `AssociatedPersonRow` (Task 4); `mapEligibilityToProfilePayload` (Teil B)
- Produces: nichts für spätere Tasks

**Eine Gefahr, die diese Task abwehren muss:** die Navigation aus Teil B schreibt bei
kinderloser Haushaltsform automatisch `children: []`. Würde der Sync daraufhin die
Kollektion mit einer leeren Kinderliste zusammenführen, löschte die Wahl „Ich lebe
allein" still die Kinder aus dem Profil. Der Merge läuft deshalb **nur bei mindestens
einem Kind**. Das ist keine Optimierung, sondern eine Schutzregel, und sie hat einen
eigenen Test.

- [ ] **Step 1: Write the failing test**

An `src/services/application.service.test.ts` anhängen. Der Import oben wird erweitert:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applicationService } from "./application.service";
```

**Zuerst, ganz oben in der Datei** (vor allen anderen Imports wirksam, `vi.mock` wird
gehoisted):

```ts
/**
 * env.config parses import.meta.env once at module scope, and vitest.setup.ts stubs
 * VITE_USE_MOCKS=true before any module loads — so syncGuestData would return before it
 * ever fetches. vi.stubEnv cannot undo that after the fact; the module has to be mocked.
 */
vi.mock("../config/env.config", () => ({
	env: {
		VITE_API_URL: "/api",
		VITE_AUTH_URL: "/auth-proxy",
		VITE_USE_MOCKS: false,
		VITE_USE_MOCK_AUTH: false,
		VITE_BYPASS_AUTH: false,
	},
}));
```

```ts
describe("syncGuestData: children", () => {
	const CHILD_ANSWERS = {
		householdComposition: HouseholdComposition.SINGLE_PARENT,
		children: [{ dateOfBirth: "2020-02-11" }],
	} as const;

	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		// authenticatedFetch wraps the global fetch and reads the auth store for a
		// bearer token; stubbing fetch is the right level and needs no token.
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const jsonResponse = (body: unknown) =>
		Promise.resolve({
			ok: true,
			status: 200,
			json: () => Promise.resolve(body),
		} as Response);

	const bodyOfLastPost = (): Record<string, unknown> => {
		const post = fetchMock.mock.calls.find(
			(call) => (call[1] as RequestInit | undefined)?.method === "POST",
		);
		return JSON.parse((post?.[1] as RequestInit).body as string);
	};

	it("merges the children into the existing collection", async () => {
		fetchMock
			.mockImplementationOnce(() =>
				jsonResponse({
					associated_persons: [
						{
							association_type: "Spouse",
							first_name: "Ingrid",
							sort_order: 0,
							lives_in_household: true,
						},
					],
				}),
			)
			.mockImplementationOnce(() => jsonResponse({}));

		await applicationService.syncGuestData(CHILD_ANSWERS);

		const persons = bodyOfLastPost().associated_persons as Array<
			Record<string, unknown>
		>;
		expect(persons).toHaveLength(2);
		expect(persons[0].first_name).toBe("Ingrid");
		expect(persons[1].association_type).toBe("Child");
	});

	it("still sends everything else when the profile cannot be read", async () => {
		fetchMock
			.mockImplementationOnce(() => Promise.reject(new Error("offline")))
			.mockImplementationOnce(() => jsonResponse({}));

		const result = await applicationService.syncGuestData({
			...CHILD_ANSWERS,
			dateOfBirth: "1997-05-02",
		});

		expect(result.success).toBe(true);
		const body = bodyOfLastPost();
		expect(body).not.toHaveProperty("associated_persons");
		expect(body.date_of_birth).toBe("1997-05-02");
	});

	/**
	 * The questionnaire writes `children: []` by itself when the household is childless,
	 * so a merge here would let "I live alone" delete someone's children.
	 */
	it("never reads or writes the collection for a childless household", async () => {
		fetchMock.mockImplementation(() => jsonResponse({}));

		await applicationService.syncGuestData({
			householdComposition: HouseholdComposition.SINGLE,
			children: [],
		});

		expect(
			fetchMock.mock.calls.filter(
				(call) => (call[1] as RequestInit | undefined)?.method !== "POST",
			),
		).toHaveLength(0);
		expect(bodyOfLastPost()).not.toHaveProperty("associated_persons");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/application.service.test.ts`
Expected: FAIL — `syncGuestData` liest das Profil noch nicht und sendet nie
`associated_persons`.

- [ ] **Step 3: Write minimal implementation**

In `src/services/application.service.ts` den Import ergänzen:

```ts
import { mergeChildren } from "./associatedPersons";
import type { AssociatedPersonRow } from "./associatedPersons";
```

Vor `applicationService` einfügen:

```ts
/**
 * Reads the profile's current `associated_persons`.
 *
 * A raw GET rather than profileService.getProfile(): the frontend Profile type has no
 * associatedPersons field, so mapProfileToFrontend drops the collection. Extending
 * ProfileSchema was rejected — mapProfileToBackend flattens every section into the
 * payload, so any profile save would then replace the collection, and a stale frontend
 * copy could silently wipe someone's household.
 *
 * Returns null when the profile cannot be read, which the caller treats as "leave the
 * children out" rather than "there are none".
 */
const readAssociatedPersons = async (): Promise<
	AssociatedPersonRow[] | null
> => {
	try {
		const response = await authenticatedFetch(`${env.VITE_API_URL}/profile`, {
			method: "GET",
			credentials: "include",
		});
		if (!response.ok) {
			return null;
		}
		const data = (await response.json()) as {
			associated_persons?: unknown;
		};
		return Array.isArray(data.associated_persons)
			? (data.associated_persons as AssociatedPersonRow[])
			: [];
	} catch {
		return null;
	}
};
```

In `syncGuestData` direkt nach `const payload = mapEligibilityToProfilePayload(answers);`
einfügen:

```ts
		/**
		 * Only with at least one child. The questionnaire writes `children: []` by itself
		 * for a childless household, so merging on an empty list would let the answer
		 * "I live alone" delete children already recorded in the profile.
		 */
		if (answers.children !== undefined && answers.children.length > 0) {
			const existing = await readAssociatedPersons();
			if (existing !== null) {
				payload.associated_persons = mergeChildren(existing, answers.children);
			}
			// GAP: the read failed. The children are left out and everything else is still
			// sent, so the worst case is the state before this merge existed.
		}
```

Den bestehenden Frühausstieg `if (Object.keys(payload).length === 0)` **oberhalb** dieses
Blocks belassen, damit ein leeres Antwortobjekt weiterhin ohne Netzwerkaufruf durchgeht.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/application.service.test.ts`
Expected: PASS — 14 Tests (11 aus Teil B, 3 neu)

- [ ] **Step 5: Suite, Typecheck, Lint**

Run: `npm test`
Expected: `Tests  1 failed | <n> passed` mit genau einem roten Test,
`ApplicationOverview.test.tsx`.

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe

Run: `npm run lint`
Expected: dieselben vier Befunde wie in der Baseline. Kein neuer.

- [ ] **Step 6: Commit**

```bash
git add src/services/application.service.ts src/services/application.service.test.ts
git commit -m "$(cat <<'EOF'
feat: merge the questionnaire's children into the profile on sign-in

Reads the profile with a raw GET before posting, so the children can be folded
into the existing collection instead of replacing it. A raw GET rather than
profileService, because the frontend Profile type has no associatedPersons field
and extending it would make every profile save replace the collection.

A failed read leaves the children out and sends everything else, so the worst
case is the state before this existed.

The merge runs only when there is at least one child. The questionnaire writes
children: [] by itself for a childless household, so merging on an empty list
would let the answer "I live alone" delete children already recorded in someone's
profile. That guard has its own test.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Manuelle Abnahme

Kein Code, aber der eigentliche Nachweis für Task 4 und 5. Die Unit-Tests prüfen die
Merge-Regel; hier wird geprüft, dass sie am echten Datensatz greift.

Der Sync ist der einzige Teil, der ein Backend braucht — und er braucht **kein
Vertex AI**. Gemini-Zugangsdaten sind nur für Chat, OCR und RAG nötig.

- [ ] **Schritt 1: Stack starten**

```bash
cd /Users/benjaminseibel/Desktop/Coding/31_beyondforms
docker compose up -d
```

Wartet, bis `migration-service` durchgelaufen ist. Die Demo-Personas werden beim Start
der Middleware angelegt (`DEMO_SEED_ENABLED=true`).

- [ ] **Schritt 2: Helmut — der Prüffall für den Datenverlust**

Helmut hat eine Ehefrau **Ingrid** in `associated_persons`. Vorher festhalten:

```bash
TOKEN=$(./scripts/demo_token.sh +493023125102)
curl -s http://localhost:8080/profile -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['associated_persons'])"
```

Dann im Browser auf <http://localhost:3000> den Check als Haushalt **mit Kindern**
durchlaufen, über den Weiter-Button mit `+493023125102` anmelden (Drama-Nummer, jeder
Code funktioniert), und danach dieselbe Abfrage wiederholen.

Erwartung: **Ingrid ist noch da**, und die Kinder sind dazugekommen.

- [ ] **Schritt 3: Sabine — die leere Kollektion**

Dasselbe mit `+493023125101`, deren `associated_persons` leer ist.

Erwartung: die Kinder sind sauber neu angelegt, `sort_order` beginnt bei 0.

- [ ] **Schritt 4: Kinderlos — die Schutzregel**

Mit Helmut den Check erneut durchlaufen, diesmal als **„Ich lebe allein"**.

Erwartung: Ingrid **und** die eben angelegten Kinder sind unverändert. Der Sync darf die
Kollektion in diesem Fall gar nicht anfassen.

---

## Abschluss

Nach Task 5 ist die Kette vollständig: Landing Page → Fragebogen → Einschätzung →
Ergebnis → Profil.

**Bewusst offen:**

- Die fünf Datenlücken (`monthlyGrossIncome`, `assetsBand`, `childReceivesFullSupport`,
  `monthsWithoutChildSupport`, `monthlyWarmRent`) warten auf das Backend. Alle sind in
  `application.service.ts` mit `GAP:` markiert.
- Die toten Locale-Schlüssel (`outcome/`, `start_screen.feature_cards`, `back_aria`) und
  die sieben toten Einträge in `i18nKeys.ts` bleiben stehen — eigener Commit, Entscheidung
  des Auftraggebers steht aus. Bei `start_screen.currently_available` ist es zudem eine
  Produktentscheidung.
- Die Verifikationsliste aus Teil A §11 ist unverändert offen. Die Ergebnisansicht zeigt
  jetzt Aussagen, die auf unverifizierten Rechtskonstanten beruhen — das erhöht die
  Dringlichkeit, ändert aber nichts am Vorgehen.
- Die Copy für rund 43 Bausteine je Sprache ist ein Vorschlag und braucht menschliche
  Prüfung.
