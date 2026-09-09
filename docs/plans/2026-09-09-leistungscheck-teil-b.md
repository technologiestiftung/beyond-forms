# Leistungscheck Teil B — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Fragebogen für die Ersteinschätzung bauen — flaches Antwortmodell, Fragenkatalog als Konfiguration, zwei neue Eingabekomponenten, dynamischer Fortschritt, Copy in DE und EN.

**Architecture:** Das Antwortmodell aus Teil A wird flach gezogen, damit ein schrittweiser Fragebogen es füllen kann. Der Flow bleibt URL-getrieben; die Reihenfolge kommt aus einem Katalog mit Skip-Bedingungen statt aus einem Knotengraphen. Die Ergebnisansicht bekommt nur eine als solche markierte Übergangslösung — sie gehört zu Teil C.

**Tech Stack:** TypeScript, Zod 4, React 19, Vitest, @testing-library/react. Keine neuen Dependencies.

**Spec:** `docs/specs/2026-09-09-leistungscheck-teil-b-design.md`

## Global Constraints

- **Arbeitsverzeichnis für alle Kommandos:** `services/wallet-frontend`
- **Tests:** `npx vitest run <pfad>` für einzelne Dateien, `npm test` für die Suite
- **Baseline vor Task 1:** `Tests 1 failed | 356 passed (357)`. Der eine rote Test ist `src/views/Application/ApplicationOverview.test.tsx` und war schon vor Teil A rot. Er bleibt rot und wird nicht angefasst. **Nach jeder Task gilt: genau ein roter Test, und zwar dieser.**
- **Einrückung:** Tabs, nicht Spaces
- **Enum-Stil:** `as const`-Objekt + gleichnamiger Type + `z.enum([...])`, wie in `benefitCheck.schema.ts`
- **Datumsformat:** ISO `YYYY-MM-DD` als String. In der Logik wird nie ein `Date` konstruiert; Vergleiche laufen lexikografisch oder über Ganzzahl-Monatsarithmetik.
- **`today` wird injiziert**, nie aus `new Date()` innerhalb der Logik gelesen. Ausnahme: Zod-Eingabevalidierung und die `max`-Grenze von Datumsfeldern.
- **Keine Anzeigetexte in der Logik.** Copy lebt ausschließlich in `src/locales/{de,en}/eligibility.json`.
- **Imports zusammenführen, nicht anhängen.** Gibt es schon ein Value-Import-Statement aus einem Modul, wird dieses erweitert. Ausnahme ist das übliche Paar aus Value-Import und separatem `import type`.
- **Übersprungene Fragen schreiben nichts.** Kein Automatismus setzt `children: []`. `undefined` heißt „noch nicht beantwortet", nicht „keine".
- **Commit-Präfix:** `feat:`, `fix:`, `test:`, `refactor:` oder `docs:` nach Conventional Commits. Jeder Commit endet mit:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
- **Branch:** `ben-vibes` (bereits ausgecheckt)

---

## Dateistruktur

| Datei | Verantwortung | Task |
|---|---|---|
| `src/schemas/benefitCheck.schema.ts` | **geändert** — 15 flache Felder | 1 |
| `src/store/benefits/derive.ts` | **geändert** — `Household` zieht hierher, `compositionImpliesChildren` neu | 1 |
| `src/store/benefits/rules.ts` | **geändert** — flache Feldpfade, drei Wächter | 1 |
| `src/store/benefits/evaluate.ts` | **geändert** — flaches `children` | 1 |
| `src/store/benefits/questionCatalogue.ts` | **neu** — 15 Fragen als Konfiguration | 2 |
| `src/store/benefits/questionPath.ts` | **neu** — Pfadauflösung über den Katalog | 3 |
| `src/store/useBenefitCheckStore.ts` | **neu** — ersetzt `useEligibilityStore` | 4 |
| `src/components/Eligibility/NumberCard.tsx` | **neu** | 5 |
| `src/components/Eligibility/ChildrenCard.tsx` | **neu** | 6 |
| `src/locales/{de,en}/eligibility.json` | **geändert** — Copy für 15 Fragen | 7 |
| `src/hooks/useBenefitCheckNavigation.ts` | **neu** — ersetzt `useEligibilityNavigation` | 8 |
| `src/views/EligibilityFlow.tsx` | **geändert** — rendert aus dem Katalog | 8 |
| `src/components/Eligibility/ProgressBar.tsx` | **geändert** — `total` aus dem Pfad | 8 |
| `src/views/EligibilityResult.tsx` | **geändert** — Übergangsansicht | 9 |
| `src/services/application.service.ts` | **geändert** — flaches Modell | 9 |
| `src/views/AuthView.tsx`, `src/views/EligibilityStart.tsx`, `src/store/useRootStore.ts` | **geändert** — neuer Store | 9 |

### Wird entfernt (Task 9)

`src/schemas/eligibility.schema.ts`, `src/store/EligibilityEngine.ts` + Test,
`src/store/useEligibilityStore.ts` + Test, `src/hooks/useEligibilityNavigation.ts`,
`src/hooks/useEligibilityOutcome.ts`.

---

## Task 1: Antwortmodell flach ziehen

Die größte Task, und sie ist **atomar**: Schema, Ableitungen und Regeln hängen aneinander,
ein Teilschritt hinterlässt einen nicht kompilierenden Baum. Nachweis, dass die Logik
unverändert bleibt, sind die 88 Tests aus Teil A — insbesondere die fünf Abnahmefälle.

**Files:**
- Modify: `src/schemas/benefitCheck.schema.ts`
- Modify: `src/store/benefits/derive.ts`
- Modify: `src/store/benefits/rules.ts`
- Modify: `src/store/benefits/evaluate.ts`
- Test: `src/store/benefits/derive.test.ts`, `rules.test.ts`, `evaluate.test.ts`, `acceptance.test.ts`, `src/schemas/benefitCheck.schema.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: `BenefitCheckAnswers` mit 15 flachen Feldern; `ChildEntry = { dateOfBirth: string }`; `Household = { composition: HouseholdComposition; children: ChildEntry[] }` (jetzt in `derive.ts`); `compositionImpliesChildren(composition: HouseholdComposition): boolean`; `minorChildren(children: ChildEntry[], today: string): ChildEntry[]`; `childrenUnder25(children: ChildEntry[], today: string): ChildEntry[]`

- [ ] **Step 1: Schema flach ziehen**

In `src/schemas/benefitCheck.schema.ts` die drei Objekt-Schemata **löschen**
(`HouseholdSchema`, `EmploymentSchema`, `ChildSupportSchema`) sowie den Export
`export type Household`. Stattdessen:

```ts
export const ChildEntrySchema = z.object({ dateOfBirth: BirthDateSchema });
export type ChildEntry = z.infer<typeof ChildEntrySchema>;

/**
 * Flat on purpose. Every question writes exactly one of these fields and every field has
 * exactly one question, so the store can validate per field via
 * `BenefitCheckAnswersSchema.shape[field]` and `Partial<>` expresses "answered so far".
 *
 * A nested shape does not survive a step-by-step questionnaire: with employment as an
 * object, `{ isEmployed: true }` fails validation because the gross income is mandatory
 * once the object exists.
 */
export const BenefitCheckAnswersSchema = z.object({
	householdComposition: HouseholdCompositionSchema,
	children: z.array(ChildEntrySchema),
	dateOfBirth: BirthDateSchema,
	livesInGermany: z.boolean(),
	workCapacity: WorkCapacitySchema,
	isEmployed: z.boolean(),
	monthlyGrossIncome: z.number().min(0),
	monthlyNetHouseholdIncome: z.number().min(0),
	monthlyWarmRent: z.number().min(0),
	assetsBand: AssetsBandSchema,
	receivesBenefitsAlready: z.boolean(),
	citizenship: CitizenshipSchema,
	hasSecureResidenceStatus: z.boolean(),
	childReceivesFullSupport: z.boolean(),
	monthsWithoutChildSupport: z.number().int().min(0),
});
```

`livesInBerlin` fällt weg, `livesInGermany` tritt an seine Stelle.

- [ ] **Step 2: Schema-Test anpassen**

In `src/schemas/benefitCheck.schema.test.ts` die drei Tests, die
`shape.household` und `shape.employment` prüfen, auf die flachen Felder umstellen:

```ts
	it("accepts a list of children", () => {
		const result = BenefitCheckAnswersSchema.shape.children.safeParse([
			{ dateOfBirth: "2019-04-02" },
		]);
		expect(result.success).toBe(true);
	});

	it("accepts an empty children array", () => {
		const result = BenefitCheckAnswersSchema.shape.children.safeParse([]);
		expect(result.success).toBe(true);
	});

	it("rejects a child born in the future", () => {
		const result = BenefitCheckAnswersSchema.shape.children.safeParse([
			{ dateOfBirth: "2999-01-01" },
		]);
		expect(result.success).toBe(false);
	});

	it("rejects a negative gross income", () => {
		const result =
			BenefitCheckAnswersSchema.shape.monthlyGrossIncome.safeParse(-1);
		expect(result.success).toBe(false);
	});
```

Die drei übrigen Tests (`dateOfBirth` ungültig, vor 1900, Feldschemata) bleiben unverändert.

- [ ] **Step 3: Ableitungen anpassen**

In `src/store/benefits/derive.ts` den `Household`-Import entfernen und den Typ hier
definieren; `compositionImpliesChildren` ergänzen; die beiden Kinderfilter auf `ChildEntry[]`
umstellen.

Import-Block:

```ts
import {
	ASSET_ALLOWANCE_BY_AGE,
	ASSET_BAND_RANGE,
	STANDARD_NEEDS_BY_LEVEL,
	retirementAgeForBirthYear,
} from "../../config/benefitRules.config";
import {
	Citizenship,
	HouseholdComposition,
} from "../../schemas/benefitCheck.schema";
import type {
	AssetsBand,
	ChildEntry,
	PartialBenefitCheckAnswers,
} from "../../schemas/benefitCheck.schema";

/**
 * The resolved household. The answer schema is flat so the questionnaire can fill it one
 * field at a time; the needs calculation wants both parts together, and the rules build
 * this once their guards have confirmed both are present.
 */
export interface Household {
	composition: HouseholdComposition;
	children: ChildEntry[];
}
```

Ersetzen: `isCouple` bleibt unverändert. Danach ergänzen bzw. ändern:

```ts
/**
 * Whether the chosen household composition means there are children at all. Used both by
 * the questionnaire's skip condition for the children question and by the two rules that
 * must tell "definitely no children" apart from "not answered yet".
 */
export const compositionImpliesChildren = (
	composition: HouseholdComposition,
): boolean =>
	composition === HouseholdComposition.SINGLE_PARENT ||
	composition === HouseholdComposition.COUPLE_WITH_CHILDREN;
```

`minorChildren` und `childrenUnder25` nehmen jetzt die Liste direkt:

```ts
export const minorChildren = (
	children: ChildEntry[],
	today: string,
): ChildEntry[] =>
	children.filter((child) => ageInYears(child.dateOfBirth, today) < 18);

export const childrenUnder25 = (
	children: ChildEntry[],
	today: string,
): ChildEntry[] =>
	children.filter((child) => ageInYears(child.dateOfBirth, today) < 25);
```

`householdStandardNeeds` und `totalNeeds` behalten ihre Signatur mit `Household` —
nur der Typ kommt jetzt von hier statt aus dem Schema.

- [ ] **Step 4: Ableitungs-Tests anpassen**

In `src/store/benefits/derive.test.ts`: die `child filters`-Suite übergibt jetzt eine
Liste statt eines Haushalts, und `compositionImpliesChildren` bekommt eine eigene Suite.

```ts
describe("child filters", () => {
	const children = [
		{ dateOfBirth: "2020-01-01" }, // 6
		{ dateOfBirth: "2008-09-09" }, // 18 exactly
		{ dateOfBirth: "2008-09-10" }, // 17
		{ dateOfBirth: "2001-09-09" }, // 25 exactly
	];

	it("counts a child as a minor until the 18th birthday", () => {
		expect(minorChildren(children, TODAY)).toHaveLength(2);
	});

	it("excludes a child on their 25th birthday", () => {
		expect(childrenUnder25(children, TODAY)).toHaveLength(3);
	});
});

describe("compositionImpliesChildren", () => {
	it("is true for the two compositions that include children", () => {
		expect(compositionImpliesChildren(HouseholdComposition.SINGLE_PARENT)).toBe(
			true,
		);
		expect(
			compositionImpliesChildren(HouseholdComposition.COUPLE_WITH_CHILDREN),
		).toBe(true);
	});

	it("is false for the two that do not", () => {
		expect(compositionImpliesChildren(HouseholdComposition.SINGLE)).toBe(false);
		expect(
			compositionImpliesChildren(HouseholdComposition.COUPLE_NO_CHILDREN),
		).toBe(false);
	});
});
```

`compositionImpliesChildren` in das bestehende `./derive`-Import-Statement aufnehmen.
Die Suiten `householdStandardNeeds` und `totalNeeds` bleiben unverändert — sie übergeben
schon ein `{ composition, children }`-Objekt.

- [ ] **Step 5: Regeln anpassen — Wächter und Feldpfade**

In `src/store/benefits/rules.ts`. `assessMeans` baut den Haushalt jetzt lokal und prüft
beide Felder:

```ts
const assessMeans = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): Verdict => {
	if (
		answers.dateOfBirth === undefined ||
		answers.householdComposition === undefined ||
		answers.children === undefined ||
		answers.monthlyWarmRent === undefined ||
		answers.monthlyNetHouseholdIncome === undefined ||
		answers.assetsBand === undefined
	) {
		return INSUFFICIENT;
	}

	const household: Household = {
		composition: answers.householdComposition,
		children: answers.children,
	};
	const needs = totalNeeds(household, answers.monthlyWarmRent, today);
	if (answers.monthlyNetHouseholdIncome >= needs) {
		return {
			status: BenefitStatus.LIKELY_NO,
			reasons: [ReasonCode.INCOME_COVERS_NEEDS],
		};
	}
	// unchanged from here: allowance, assetsVsAllowance, the three branches
```

`Household` als Type aus `./derive` importieren.

**Wichtig:** `answers.children === undefined` im Wächter bedeutet, dass ein kinderloser
Haushalt die Frage übersprungen bekommt und `children` nie gesetzt wird — dann würde
`assessMeans` dauerhaft `INSUFFICIENT` liefern. Deshalb gilt hier eine Ausnahme von der
globalen Regel: **der Flow schreibt `children: []`, wenn die Haushaltsform kinderlos ist.**
Siehe Task 8, Step 3. Die Regel „übersprungene Fragen schreiben nichts" gilt weiter für
alle anderen Felder; `children` ist der einzige Fall, in dem die Antwort auf Frage 1 die
Antwort auf Frage 2 bereits vollständig bestimmt.

- [ ] **Step 6: Regeln anpassen — die drei Sammelfelder**

Im selben File, `assessSgbXiiSubsistenceAid`: den Wächterblock und die Bedarfsberechnung
umstellen.

```ts
	if (
		answers.householdComposition === undefined ||
		answers.children === undefined ||
		answers.monthlyWarmRent === undefined ||
		answers.monthlyNetHouseholdIncome === undefined ||
		answers.assetsBand === undefined
	) {
		return { benefit, ...INSUFFICIENT };
	}

	const household: Household = {
		composition: answers.householdComposition,
		children: answers.children,
	};
	const needs = totalNeeds(household, answers.monthlyWarmRent, today);
```

`assessHousingBenefit`: gleiche Umstellung, `householdStandardNeeds(household, today)`.

`assessChildSupplement` — dreistufiger Wächter statt des einstufigen:

```ts
	if (answers.householdComposition === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (!compositionImpliesChildren(answers.householdComposition)) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NO_ELIGIBLE_CHILDREN],
		};
	}
	if (answers.children === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (childrenUnder25(answers.children, today).length === 0) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NO_ELIGIBLE_CHILDREN],
		};
	}
```

Danach unverändert: Nachrang-Prüfung, dann `isCouple(answers.householdComposition)` für die
Mindesteinkommensgrenze und `answers.monthlyGrossIncome` statt
`answers.employment.monthlyGrossIncome`. Der Wächter für das Bruttoeinkommen wird
`answers.monthlyGrossIncome === undefined`.

`assessAdvanceMaintenance` — analog:

```ts
	if (answers.householdComposition === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (answers.householdComposition !== HouseholdComposition.SINGLE_PARENT) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NOT_SINGLE_PARENT],
		};
	}
	if (answers.children === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (minorChildren(answers.children, today).length === 0) {
		return {
			benefit,
			status: BenefitStatus.NOT_APPLICABLE,
			reasons: [ReasonCode.NO_MINOR_CHILDREN],
		};
	}
	if (answers.childReceivesFullSupport === undefined) {
		return { benefit, ...INSUFFICIENT };
	}
	if (answers.childReceivesFullSupport) {
		return {
			benefit,
			status: BenefitStatus.LIKELY_NO,
			reasons: [ReasonCode.CHILD_RECEIVES_FULL_SUPPORT],
		};
	}

	return {
		benefit,
		status: BenefitStatus.LIKELY_YES,
		reasons: [ReasonCode.CHILD_SUPPORT_INCOMPLETE],
	};
```

`compositionImpliesChildren` in das bestehende `./derive`-Import-Statement aufnehmen.

- [ ] **Step 7: Aggregation anpassen**

In `src/store/benefits/evaluate.ts` eine Zeile:

```ts
	const hasChildren = (answers.children?.length ?? 0) > 0;
```

- [ ] **Step 8: Alle Test-Fixtures flach ziehen**

In `rules.test.ts`, `evaluate.test.ts` und `acceptance.test.ts` jedes Fixture umstellen.
Muster:

```ts
// vorher
	household: { composition: HouseholdComposition.SINGLE, children: [] },
	employment: { isEmployed: true, monthlyGrossIncome: 1400 },
	childSupport: { receivesFullSupport: false, monthsWithoutSupport: 8 },

// nachher
	householdComposition: HouseholdComposition.SINGLE,
	children: [],
	isEmployed: true,
	monthlyGrossIncome: 1400,
	childReceivesFullSupport: false,
	monthsWithoutChildSupport: 8,
```

Ebenso `livesInBerlin: true` → `livesInGermany: true`.

Die Tests, die ein Feld gezielt entfernen, brauchen den neuen Feldnamen:

```ts
	it("advises a check when only the asset band is missing", () => {
		const { assetsBand: _dropped, ...withoutAssets } = CASE_A;
		// unverändert
	});

	it("advises a check when the support question is unanswered", () => {
		const { childReceivesFullSupport: _dropped, ...withoutSupport } = CASE_C;
		// unverändert
	});
```

Tests, die `household` überschreiben, werden zu zwei Feldern:

```ts
	it("does not apply to a couple", () => {
		const result = assessAdvanceMaintenance(
			{
				...CASE_C,
				householdComposition: HouseholdComposition.COUPLE_WITH_CHILDREN,
			},
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.NOT_SINGLE_PARENT]);
	});
```

- [ ] **Step 9: Zwei Tests für die neuen Wächter ergänzen**

An `rules.test.ts` anhängen. Diese Fälle waren im verschachtelten Modell nicht
darstellbar und sind der eigentliche Gewinn der Umstellung:

```ts
describe("children guards after flattening", () => {
	it("child supplement is not applicable for a definitively childless household", () => {
		const result = assessChildSupplement(
			{ ...CASE_C, householdComposition: HouseholdComposition.SINGLE },
			TODAY,
		);
		expect(result.status).toBe(BenefitStatus.NOT_APPLICABLE);
		expect(result.reasons).toEqual([ReasonCode.NO_ELIGIBLE_CHILDREN]);
	});

	it("child supplement advises a check while the children list is unanswered", () => {
		const { children: _dropped, ...withoutChildren } = CASE_C;
		const result = assessChildSupplement(withoutChildren, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});

	it("advance maintenance advises a check while the children list is unanswered", () => {
		const { children: _dropped, ...withoutChildren } = CASE_C;
		const result = assessAdvanceMaintenance(withoutChildren, TODAY);
		expect(result.status).toBe(BenefitStatus.CHECK_ADVISED);
		expect(result.reasons).toEqual([ReasonCode.INSUFFICIENT_DATA]);
	});
});
```

- [ ] **Step 10: Suite, Typecheck, Lint**

Run: `npm test`
Expected: `Tests  1 failed | 359 passed (360)` — die drei neuen Tests aus Step 9 kommen
hinzu, der eine rote bleibt `ApplicationOverview.test.tsx`. Schlägt ein Abnahmefall aus
`acceptance.test.ts` fehl, ist beim Umstellen ein Wächter falsch geworden — dort
korrigieren, nicht den Test anpassen.

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe

Run: `npx eslint src/schemas/ src/store/benefits/`
Expected: keine Ausgabe

- [ ] **Step 11: Commit**

```bash
git add src/schemas/benefitCheck.schema.ts src/schemas/benefitCheck.schema.test.ts src/store/benefits/
git commit -m "$(cat <<'EOF'
refactor: flatten the benefit check answer model

The nested model does not survive a step-by-step questionnaire. Fields inside
EmploymentSchema and ChildSupportSchema are mandatory once the object exists, so
"answered isEmployed, gross income still open" was not representable. Fifteen
optional top-level fields replace it, one per question.

compositionImpliesChildren is the single source for two things that must agree:
the questionnaire's skip condition for the children question, and the rules'
distinction between "definitely no children" and "not answered yet". The child
supplement and advance maintenance guards are now three-stage, so an unanswered
children list yields INSUFFICIENT_DATA instead of a rejection.

livesInBerlin becomes livesInGermany: the field feeds is_resident_in_germany in
the profile, which the Berlin-specific name would have obscured.

The five acceptance cases from the domain spec are unchanged and still pass,
which is the evidence that the logic came through the refactor intact.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fragenkatalog

**Files:**
- Create: `src/store/benefits/questionCatalogue.ts`
- Test: `src/store/benefits/questionCatalogue.test.ts`

**Interfaces:**
- Consumes: `BenefitCheckAnswers`, `PartialBenefitCheckAnswers`, `HouseholdComposition`, `WorkCapacity`, `AssetsBand`, `Citizenship` (Task 1); `compositionImpliesChildren`, `hasReachedRetirementAge` (Task 1)
- Produces: `QUESTION_CATALOGUE: readonly BenefitQuestion[]`, `BenefitQuestion`, `QuestionInput`, `BINARY_OPTIONS`

- [ ] **Step 1: Write the failing test**

`src/store/benefits/questionCatalogue.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	BenefitCheckAnswersSchema,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import { QUESTION_CATALOGUE } from "./questionCatalogue";

const TODAY = "2026-09-09";

describe("QUESTION_CATALOGUE", () => {
	it("has exactly one question per answer field and no orphans", () => {
		const fields = Object.keys(BenefitCheckAnswersSchema.shape).sort();
		const asked = QUESTION_CATALOGUE.map((q) => q.field as string).sort();
		expect(asked).toEqual(fields);
	});

	it("has unique route ids", () => {
		const ids = QUESTION_CATALOGUE.map((q) => q.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("offers options for every choice question and none for the others", () => {
		for (const question of QUESTION_CATALOGUE) {
			if (question.input === "choice") {
				expect(question.options, question.id).toBeDefined();
				expect(question.options?.length, question.id).toBeGreaterThan(1);
			} else {
				expect(question.options, question.id).toBeUndefined();
			}
		}
	});

	it("gives every number question a unit", () => {
		for (const question of QUESTION_CATALOGUE) {
			if (question.input === "number") {
				expect(question.unit, question.id).toBeDefined();
			}
		}
	});

	it("never skips on an empty answer set", () => {
		for (const question of QUESTION_CATALOGUE) {
			expect(question.skipIf?.({}, TODAY) ?? false, question.id).toBe(false);
		}
	});

	it("skips the children questions for a childless household", () => {
		const childless = { householdComposition: HouseholdComposition.SINGLE };
		const skipped = QUESTION_CATALOGUE.filter((q) =>
			q.skipIf?.(childless, TODAY),
		).map((q) => q.id);
		expect(skipped).toContain("children");
		expect(skipped).toContain("child-support");
	});

	it("skips work capacity once the retirement age is reached", () => {
		const retired = { dateOfBirth: "1950-01-01" };
		const skipped = QUESTION_CATALOGUE.filter((q) =>
			q.skipIf?.(retired, TODAY),
		).map((q) => q.id);
		expect(skipped).toContain("work-capacity");
	});

	it("skips the gross income question when not employed", () => {
		const skipped = QUESTION_CATALOGUE.filter((q) =>
			q.skipIf?.({ isEmployed: false }, TODAY),
		).map((q) => q.id);
		expect(skipped).toContain("gross-income");
	});

	it("skips the residence status question for EU citizens", () => {
		const skipped = QUESTION_CATALOGUE.filter((q) =>
			q.skipIf?.({ citizenship: Citizenship.DE_EU }, TODAY),
		).map((q) => q.id);
		expect(skipped).toContain("residence-status");
	});

	it("skips the support duration unless support is actually missing", () => {
		const missing = QUESTION_CATALOGUE.find(
			(q) => q.id === "support-duration",
		);
		expect(missing?.skipIf?.({ childReceivesFullSupport: true }, TODAY)).toBe(
			true,
		);
		expect(missing?.skipIf?.({ childReceivesFullSupport: false }, TODAY)).toBe(
			false,
		);
	});

	it("declares options that the schema accepts", () => {
		const byField = {
			householdComposition: Object.values(HouseholdComposition),
			workCapacity: Object.values(WorkCapacity),
			assetsBand: Object.values(AssetsBand),
			citizenship: Object.values(Citizenship),
		} as Record<string, string[]>;

		for (const question of QUESTION_CATALOGUE) {
			const allowed = byField[question.field as string];
			if (question.input === "choice" && allowed) {
				expect([...(question.options ?? [])].sort(), question.id).toEqual(
					[...allowed].sort(),
				);
			}
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/questionCatalogue.test.ts`
Expected: FAIL — `Failed to resolve import "./questionCatalogue"`

- [ ] **Step 3: Write minimal implementation**

`src/store/benefits/questionCatalogue.ts`:

```ts
import {
	AssetsBand,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type {
	BenefitCheckAnswers,
	PartialBenefitCheckAnswers,
} from "../../schemas/benefitCheck.schema";
import { compositionImpliesChildren, hasReachedRetirementAge } from "./derive";

export type QuestionInput = "choice" | "boolean" | "date" | "number" | "children";

export interface BenefitQuestion {
	/** Route segment under /eligibility-check/. */
	id: string;
	field: keyof BenefitCheckAnswers;
	input: QuestionInput;
	/** Only for "choice". Boolean questions use BINARY_OPTIONS. */
	options?: readonly string[];
	/** Only for "number". Drives the suffix the input shows. */
	unit?: "EUR" | "MONTHS";
	/**
	 * May only read fields collected EARLIER in this array, and must return false while
	 * the field it reads is undefined — an unanswered question must never cause a skip.
	 */
	skipIf?: (answers: PartialBenefitCheckAnswers, today: string) => boolean;
}

/** Boolean questions render through QuestionCard, which works on option strings. */
export const BINARY_OPTIONS = ["YES", "NO"] as const;

const childless = (answers: PartialBenefitCheckAnswers): boolean =>
	answers.householdComposition !== undefined &&
	!compositionImpliesChildren(answers.householdComposition);

export const QUESTION_CATALOGUE: readonly BenefitQuestion[] = [
	{
		id: "household",
		field: "householdComposition",
		input: "choice",
		options: [
			HouseholdComposition.SINGLE,
			HouseholdComposition.SINGLE_PARENT,
			HouseholdComposition.COUPLE_NO_CHILDREN,
			HouseholdComposition.COUPLE_WITH_CHILDREN,
		],
	},
	{
		id: "children",
		field: "children",
		input: "children",
		skipIf: childless,
	},
	{
		id: "birthdate",
		field: "dateOfBirth",
		input: "date",
	},
	{
		id: "germany",
		field: "livesInGermany",
		input: "boolean",
	},
	{
		id: "work-capacity",
		field: "workCapacity",
		input: "choice",
		options: [
			WorkCapacity.FULL,
			WorkCapacity.TEMPORARILY_REDUCED,
			WorkCapacity.PERMANENTLY_REDUCED,
		],
		skipIf: (answers, today) =>
			answers.dateOfBirth !== undefined &&
			hasReachedRetirementAge(answers.dateOfBirth, today),
	},
	{
		id: "employment",
		field: "isEmployed",
		input: "boolean",
	},
	{
		id: "gross-income",
		field: "monthlyGrossIncome",
		input: "number",
		unit: "EUR",
		skipIf: (answers) => answers.isEmployed === false,
	},
	{
		id: "net-income",
		field: "monthlyNetHouseholdIncome",
		input: "number",
		unit: "EUR",
	},
	{
		id: "warm-rent",
		field: "monthlyWarmRent",
		input: "number",
		unit: "EUR",
	},
	{
		id: "assets",
		field: "assetsBand",
		input: "choice",
		options: [
			AssetsBand.UNDER_5000,
			AssetsBand.FROM_5000_TO_15000,
			AssetsBand.FROM_15000_TO_25000,
			AssetsBand.OVER_25000,
		],
	},
	{
		id: "benefits",
		field: "receivesBenefitsAlready",
		input: "boolean",
	},
	{
		/**
		 * Always asked. The domain spec §4 skips it unless other answers suggest a claim,
		 * but every one of the six rules needs the residence requirement, so skipping it
		 * puts all six on CHECK_ADVISED/INSUFFICIENT_DATA — anyone not asked gets no
		 * result at all.
		 */
		id: "citizenship",
		field: "citizenship",
		input: "choice",
		options: [Citizenship.DE_EU, Citizenship.NON_EU],
	},
	{
		id: "residence-status",
		field: "hasSecureResidenceStatus",
		input: "boolean",
		skipIf: (answers) => answers.citizenship === Citizenship.DE_EU,
	},
	{
		id: "child-support",
		field: "childReceivesFullSupport",
		input: "boolean",
		skipIf: childless,
	},
	{
		id: "support-duration",
		field: "monthsWithoutChildSupport",
		input: "number",
		unit: "MONTHS",
		skipIf: (answers) => answers.childReceivesFullSupport !== false,
	},
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/questionCatalogue.test.ts`
Expected: PASS — 10 tests

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/questionCatalogue.ts src/store/benefits/questionCatalogue.test.ts
git commit -m "$(cat <<'EOF'
feat: add the benefit check question catalogue

Fifteen questions as configuration rather than a wired-up sequence, each naming
its field, its input kind and its skip condition. A test asserts the 1:1 mapping
against the schema's own shape, so a field without a question or a question
without a field fails the build rather than shipping.

Citizenship is always asked. The domain spec skips it unless other answers
suggest a claim, but every rule needs the residence requirement, so skipping it
would leave the whole assessment on "insufficient data".

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Pfadauflösung

**Files:**
- Create: `src/store/benefits/questionPath.ts`
- Test: `src/store/benefits/questionPath.test.ts`

**Interfaces:**
- Consumes: `QUESTION_CATALOGUE`, `BenefitQuestion` (Task 2)
- Produces: `activeQuestions(answers, today): BenefitQuestion[]`, `getValidPath(answers, today): BenefitQuestion[]`, `questionById(id): BenefitQuestion | undefined`

- [ ] **Step 1: Write the failing test**

`src/store/benefits/questionPath.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../../schemas/benefitCheck.schema";
import type { PartialBenefitCheckAnswers } from "../../schemas/benefitCheck.schema";
import { activeQuestions, getValidPath, questionById } from "./questionPath";

const TODAY = "2026-09-09";

describe("activeQuestions", () => {
	it("offers all fifteen questions while nothing is answered", () => {
		expect(activeQuestions({}, TODAY)).toHaveLength(15);
	});

	it("drops the three child questions for a single person", () => {
		const active = activeQuestions(
			{ householdComposition: HouseholdComposition.SINGLE },
			TODAY,
		).map((q) => q.id);
		expect(active).not.toContain("children");
		expect(active).not.toContain("child-support");
		expect(active).not.toContain("support-duration");
		expect(active).toHaveLength(12);
	});
});

describe("getValidPath", () => {
	it("is just the first question while nothing is answered", () => {
		const path = getValidPath({}, TODAY);
		expect(path.map((q) => q.id)).toEqual(["household"]);
	});

	it("grows by one as each question is answered", () => {
		const path = getValidPath(
			{ householdComposition: HouseholdComposition.SINGLE },
			TODAY,
		);
		expect(path.map((q) => q.id)).toEqual(["household", "birthdate"]);
	});

	it("stops after the first unanswered question", () => {
		const path = getValidPath(
			{
				householdComposition: HouseholdComposition.SINGLE,
				dateOfBirth: "1994-01-15",
			},
			TODAY,
		);
		expect(path.map((q) => q.id)).toEqual([
			"household",
			"birthdate",
			"germany",
		]);
	});

	it("covers the whole path for a complete answer set", () => {
		const complete: PartialBenefitCheckAnswers = {
			householdComposition: HouseholdComposition.SINGLE,
			dateOfBirth: "1994-01-15",
			livesInGermany: true,
			workCapacity: WorkCapacity.FULL,
			isEmployed: true,
			monthlyGrossIncome: 1400,
			monthlyNetHouseholdIncome: 1100,
			monthlyWarmRent: 650,
			assetsBand: AssetsBand.UNDER_5000,
			receivesBenefitsAlready: false,
			citizenship: Citizenship.DE_EU,
		};
		expect(getValidPath(complete, TODAY)).toHaveLength(11);
	});

	it("treats an empty children list as answered", () => {
		const path = getValidPath(
			{
				householdComposition: HouseholdComposition.SINGLE_PARENT,
				children: [],
			},
			TODAY,
		);
		expect(path.map((q) => q.id)).toEqual([
			"household",
			"children",
			"birthdate",
		]);
	});
});

describe("questionById", () => {
	it("finds a question by its route id", () => {
		expect(questionById("warm-rent")?.field).toBe("monthlyWarmRent");
	});

	it("returns undefined for an unknown id", () => {
		expect(questionById("nope")).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/questionPath.test.ts`
Expected: FAIL — `Failed to resolve import "./questionPath"`

- [ ] **Step 3: Write minimal implementation**

`src/store/benefits/questionPath.ts`:

```ts
import type { PartialBenefitCheckAnswers } from "../../schemas/benefitCheck.schema";
import { QUESTION_CATALOGUE } from "./questionCatalogue";
import type { BenefitQuestion } from "./questionCatalogue";

/** Every question the current answers do not skip, in catalogue order. */
export const activeQuestions = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitQuestion[] =>
	QUESTION_CATALOGUE.filter(
		(question) => !(question.skipIf?.(answers, today) ?? false),
	);

/**
 * The active questions up to and including the first unanswered one. Replaces the graph
 * walk of the old EligibilityEngine: the catalogue plus its skip conditions already
 * describes the order, so this only has to cut it off.
 */
export const getValidPath = (
	answers: PartialBenefitCheckAnswers,
	today: string,
): BenefitQuestion[] => {
	const active = activeQuestions(answers, today);
	const firstUnanswered = active.findIndex(
		(question) => answers[question.field] === undefined,
	);
	return firstUnanswered === -1
		? active
		: active.slice(0, firstUnanswered + 1);
};

export const questionById = (id: string): BenefitQuestion | undefined =>
	QUESTION_CATALOGUE.find((question) => question.id === id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/questionPath.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/store/benefits/questionPath.ts src/store/benefits/questionPath.test.ts
git commit -m "$(cat <<'EOF'
feat: add question path resolution over the catalogue

Replaces the graph walk in EligibilityEngine. The catalogue and its skip
conditions already describe the order, so resolving a path is filtering plus a
cut after the first unanswered question — no per-node next() and no NodeId union.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Store

**Files:**
- Create: `src/store/useBenefitCheckStore.ts`
- Test: `src/store/useBenefitCheckStore.test.ts`

**Interfaces:**
- Consumes: `BenefitCheckAnswersSchema`, `BenefitCheckAnswers`, `PartialBenefitCheckAnswers` (Task 1); `getValidPath` (Task 3)
- Produces: `useBenefitCheckStore` mit `answers`, `maxDepthReached`, `validationError`, `setAnswer(field, value)`, `clearAnswer(field)`, `recordStepReached(step)`, `resetForm()`, `clearError()`

- [ ] **Step 1: Write the failing test**

`src/store/useBenefitCheckStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
	AssetsBand,
	HouseholdComposition,
} from "../schemas/benefitCheck.schema";
import { useBenefitCheckStore } from "./useBenefitCheckStore";

describe("useBenefitCheckStore", () => {
	beforeEach(() => {
		useBenefitCheckStore.getState().resetForm();
	});

	it("stores a valid answer", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		expect(useBenefitCheckStore.getState().answers.householdComposition).toBe(
			HouseholdComposition.SINGLE,
		);
		expect(useBenefitCheckStore.getState().validationError).toBeNull();
	});

	it("rejects an invalid answer and records the error instead of throwing", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("assetsBand", "NOPE" as AssetsBand);
		expect(useBenefitCheckStore.getState().answers.assetsBand).toBeUndefined();
		expect(useBenefitCheckStore.getState().validationError).toBeTruthy();
	});

	it("rejects a negative number", () => {
		useBenefitCheckStore.getState().setAnswer("monthlyWarmRent", -5);
		expect(
			useBenefitCheckStore.getState().answers.monthlyWarmRent,
		).toBeUndefined();
		expect(useBenefitCheckStore.getState().validationError).toBeTruthy();
	});

	it("clears the error on the next valid answer", () => {
		useBenefitCheckStore.getState().setAnswer("monthlyWarmRent", -5);
		useBenefitCheckStore.getState().setAnswer("monthlyWarmRent", 650);
		expect(useBenefitCheckStore.getState().answers.monthlyWarmRent).toBe(650);
		expect(useBenefitCheckStore.getState().validationError).toBeNull();
	});

	it("accepts an empty children list", () => {
		useBenefitCheckStore.getState().setAnswer("children", []);
		expect(useBenefitCheckStore.getState().answers.children).toEqual([]);
	});

	it("removes exactly one field on clearAnswer", () => {
		const store = useBenefitCheckStore.getState();
		store.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		store.setAnswer("monthlyWarmRent", 650);
		useBenefitCheckStore.getState().clearAnswer("monthlyWarmRent");
		expect(
			useBenefitCheckStore.getState().answers.monthlyWarmRent,
		).toBeUndefined();
		expect(useBenefitCheckStore.getState().answers.householdComposition).toBe(
			HouseholdComposition.SINGLE,
		);
	});

	it("never lets maxDepthReached exceed the current path length", () => {
		useBenefitCheckStore.getState().recordStepReached(9);
		// Nothing is answered, so the path is one question long.
		expect(useBenefitCheckStore.getState().maxDepthReached).toBe(1);
	});

	it("remembers the deepest step reached", () => {
		const store = useBenefitCheckStore.getState();
		store.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		store.setAnswer("dateOfBirth", "1994-01-15");
		useBenefitCheckStore.getState().recordStepReached(3);
		expect(useBenefitCheckStore.getState().maxDepthReached).toBe(3);
		useBenefitCheckStore.getState().recordStepReached(2);
		expect(useBenefitCheckStore.getState().maxDepthReached).toBe(3);
	});

	it("resets everything", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		useBenefitCheckStore.getState().resetForm();
		expect(useBenefitCheckStore.getState().answers).toEqual({});
		expect(useBenefitCheckStore.getState().maxDepthReached).toBe(0);
		expect(useBenefitCheckStore.getState().validationError).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/useBenefitCheckStore.test.ts`
Expected: FAIL — `Failed to resolve import "./useBenefitCheckStore"`

- [ ] **Step 3: Write minimal implementation**

`src/store/useBenefitCheckStore.ts`:

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { BenefitCheckAnswersSchema } from "../schemas/benefitCheck.schema";
import type {
	BenefitCheckAnswers,
	PartialBenefitCheckAnswers,
} from "../schemas/benefitCheck.schema";
import { getValidPath } from "./benefits/questionPath";
import { createZustandStorage } from "../utils/storage";

/** Input validation only; the engine always takes `today` as an argument. */
const todayIsoDate = (): string => new Date().toLocaleDateString("sv-SE");

interface BenefitCheckState {
	answers: PartialBenefitCheckAnswers;
	maxDepthReached: number;
	validationError: string | null;
	setAnswer: <K extends keyof BenefitCheckAnswers>(
		field: K,
		value: BenefitCheckAnswers[K],
	) => void;
	clearAnswer: (field: keyof BenefitCheckAnswers) => void;
	recordStepReached: (step: number) => void;
	resetForm: () => void;
	clearError: () => void;
}

export const useBenefitCheckStore = create<BenefitCheckState>()(
	persist(
		(set, get) => {
			const pathLength = (answers: PartialBenefitCheckAnswers): number =>
				getValidPath(answers, todayIsoDate()).length;

			return {
				answers: {},
				maxDepthReached: 0,
				validationError: null,

				setAnswer: (field, value) => {
					const fieldSchema = BenefitCheckAnswersSchema.shape[field];
					const result = fieldSchema.safeParse(value);
					if (!result.success) {
						set({ validationError: result.error.issues[0].message });
						return;
					}
					const answers = { ...get().answers, [field]: result.data };
					set({
						answers,
						validationError: null,
						maxDepthReached: Math.min(
							get().maxDepthReached,
							pathLength(answers),
						),
					});
				},

				clearAnswer: (field) => {
					const { [field]: _removed, ...answers } = get().answers;
					set({
						answers,
						validationError: null,
						maxDepthReached: Math.min(
							get().maxDepthReached,
							pathLength(answers),
						),
					});
				},

				recordStepReached: (step) => {
					set({
						maxDepthReached: Math.min(
							Math.max(get().maxDepthReached, step),
							pathLength(get().answers),
						),
					});
				},

				resetForm: () =>
					set({ answers: {}, maxDepthReached: 0, validationError: null }),

				clearError: () => set({ validationError: null }),
			};
		},
		{
			name: "beyond-forms-wallet-session",
			storage: createJSONStorage(() => createZustandStorage("session")),
			// 8 was the last version of useEligibilityStore, whose answer shape is
			// incompatible. Without the bump an open tab would carry old answers into
			// per-field validation and fail on every one.
			version: 9,
		},
	),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/useBenefitCheckStore.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/store/useBenefitCheckStore.ts src/store/useBenefitCheckStore.test.ts
git commit -m "$(cat <<'EOF'
feat: add the benefit check store

Keeps the shape of useEligibilityStore — per-field validation that records an
error rather than throwing, and a monotonic maxDepthReached — over the flat
fifteen-field answer model.

The persist version goes to 9. Eight was the old store's, whose answer shape is
incompatible; without the bump an open tab would carry old answers into per-field
validation and fail on every one.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: NumberCard

**Files:**
- Create: `src/components/Eligibility/NumberCard.tsx`
- Test: `src/components/Eligibility/NumberCard.test.tsx`

**Interfaces:**
- Consumes: `PrimaryButton`, `i18nKeys`
- Produces: `NumberCard` mit Props `{ id, question, category, tip?, unitLabel, value?: number, onChange: (v: number) => void, onClear: () => void, onNext: () => void }`

- [ ] **Step 1: Write the failing test**

`src/components/Eligibility/NumberCard.test.tsx`:

```ts
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NumberCard } from "./NumberCard";

const baseProps = {
	id: "warm-rent",
	question: "Wie hoch ist Deine Warmmiete im Monat?",
	category: "Wohnen",
	unitLabel: "Euro",
	onChange: vi.fn(),
	onClear: vi.fn(),
	onNext: vi.fn(),
};

describe("NumberCard", () => {
	it("reports a plain number", () => {
		const onChange = vi.fn();
		render(<NumberCard {...baseProps} onChange={onChange} />);
		fireEvent.change(screen.getByTestId("number-input"), {
			target: { value: "650" },
		});
		expect(onChange).toHaveBeenCalledWith(650);
	});

	it("accepts a decimal comma and reports a number", () => {
		const onChange = vi.fn();
		render(<NumberCard {...baseProps} onChange={onChange} />);
		fireEvent.change(screen.getByTestId("number-input"), {
			target: { value: "430,87" },
		});
		expect(onChange).toHaveBeenCalledWith(430.87);
	});

	it("ignores letters entirely", () => {
		const onChange = vi.fn();
		render(<NumberCard {...baseProps} onChange={onChange} />);
		fireEvent.change(screen.getByTestId("number-input"), {
			target: { value: "abc" },
		});
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByTestId("number-input")).toHaveValue("");
	});

	it("clears rather than reporting zero for an empty field", () => {
		const onClear = vi.fn();
		const onChange = vi.fn();
		render(
			<NumberCard
				{...baseProps}
				value={650}
				onChange={onChange}
				onClear={onClear}
			/>,
		);
		fireEvent.change(screen.getByTestId("number-input"), {
			target: { value: "" },
		});
		expect(onClear).toHaveBeenCalled();
		expect(onChange).not.toHaveBeenCalledWith(0);
	});

	it("keeps the next button disabled without a value", () => {
		render(<NumberCard {...baseProps} />);
		expect(screen.getByTestId("next-button")).toBeDisabled();
	});

	it("enables the next button once a value is set", () => {
		render(<NumberCard {...baseProps} value={0} />);
		expect(screen.getByTestId("next-button")).not.toBeDisabled();
	});

	it("shows the unit label", () => {
		render(<NumberCard {...baseProps} />);
		expect(screen.getByText("Euro")).toBeInTheDocument();
	});

	it("uses a decimal keypad rather than a spinner", () => {
		render(<NumberCard {...baseProps} />);
		const input = screen.getByTestId("number-input");
		expect(input).toHaveAttribute("type", "text");
		expect(input).toHaveAttribute("inputMode", "decimal");
	});
});
```

Note: `value={0}` in the sixth test is deliberate — zero is a legitimate answer (no
income), so the button must key off `value !== undefined`, not truthiness.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Eligibility/NumberCard.test.tsx`
Expected: FAIL — `Failed to resolve import "./NumberCard"`

- [ ] **Step 3: Write minimal implementation**

`src/components/Eligibility/NumberCard.tsx`:

```tsx
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";
import { PrimaryButton } from "../ui/PrimaryButton";
import { Info } from "lucide-react";

interface NumberCardProps {
	id: string;
	question: string;
	category: string;
	tip?: string;
	unitLabel: string;
	value?: number;
	onChange: (value: number) => void;
	onClear: () => void;
	onNext: () => void;
}

/** Digits plus a single separator, which German speakers will type as a comma. */
const ALLOWED = /^[0-9]*[.,]?[0-9]*$/;

export const NumberCard: React.FC<NumberCardProps> = ({
	id,
	question,
	category,
	tip,
	unitLabel,
	value,
	onChange,
	onClear,
	onNext,
}) => {
	const { t } = useTranslation();
	const labelRef = useRef<HTMLLabelElement>(null);
	const [draft, setDraft] = useState(value === undefined ? "" : String(value));

	useEffect(() => {
		labelRef.current?.focus();
	}, [id]);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const raw = event.target.value;
		// Reject the keystroke outright rather than silently dropping characters, so what
		// is on screen is always what was typed.
		if (!ALLOWED.test(raw)) {
			return;
		}
		setDraft(raw);

		if (raw === "" || raw === "." || raw === ",") {
			onClear();
			return;
		}
		const parsed = Number(raw.replace(",", "."));
		if (!Number.isNaN(parsed)) {
			onChange(parsed);
		}
	};

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (value !== undefined) {
			onNext();
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			data-testid="question-card"
			className="w-full font-sans flex flex-col justify-between flex-grow min-h-[360px]"
		>
			<fieldset className="w-full border-none p-0 m-0 flex flex-col gap-6 mb-8">
				<div className="flex flex-col gap-3">
					<p className="text-body text-brand-grey">
						{t(i18nKeys.eligibility.title)}
					</p>
					<h1 className="text-xl font-bold text-brand-black leading-snug">
						{category}
					</h1>
				</div>

				{tip && (
					<div
						id={`${id}-tip`}
						className="bg-brand-bg border border-brand-border/40 rounded-xl p-4 flex gap-2 items-start"
					>
						<Info
							className="size-5 text-brand-grey shrink-0 mt-0.5"
							aria-hidden="true"
						/>
						<p className="text-base text-brand-grey leading-snug whitespace-pre-line">
							{tip}
						</p>
					</div>
				)}

				<div className="w-full">
					<label
						ref={labelRef}
						htmlFor={`${id}-number`}
						tabIndex={-1}
						id={`${id}-legend`}
						className="font-bold text-brand-black leading-snug focus:outline-none mb-6 block"
					>
						{question}
					</label>
					<div className="flex items-center gap-3">
						<input
							id={`${id}-number`}
							// Not type="number": that shows spinner arrows on mobile and lets a
							// stray scroll change the value.
							type="text"
							inputMode="decimal"
							autoComplete="off"
							aria-labelledby={`${id}-legend`}
							aria-describedby={tip ? `${id}-tip` : undefined}
							data-testid="number-input"
							value={draft}
							onChange={handleChange}
							className="h-12 flex-1 px-3 rounded-xl border-2 border-brand-border/30 text-base text-brand-black bg-white focus:outline-none focus:border-brand-primary"
						/>
						<span className="text-base text-brand-grey shrink-0">
							{unitLabel}
						</span>
					</div>
				</div>
			</fieldset>

			<div className="w-full">
				<PrimaryButton
					type="submit"
					disabled={value === undefined}
					data-testid="next-button"
				>
					{t(i18nKeys.common.next)}
				</PrimaryButton>
			</div>
		</form>
	);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Eligibility/NumberCard.test.tsx`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/Eligibility/NumberCard.tsx src/components/Eligibility/NumberCard.test.tsx
git commit -m "$(cat <<'EOF'
feat: add NumberCard for the amount questions

Carries the header structure of QuestionCard so the screens do not differ.

type="text" with inputMode="decimal" rather than type="number": the latter shows
spinner arrows on mobile and lets a stray scroll change an amount. A decimal comma
is accepted and converted, since that is how German speakers type amounts.

An empty field clears rather than reporting zero, and the next button keys off
value !== undefined — zero is a legitimate answer for someone with no income.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: ChildrenCard

**Files:**
- Create: `src/components/Eligibility/ChildrenCard.tsx`
- Test: `src/components/Eligibility/ChildrenCard.test.tsx`

**Interfaces:**
- Consumes: `PrimaryButton`, `i18nKeys`, `ChildEntry` (Task 1)
- Produces: `ChildrenCard` mit Props `{ id, question, category, tip?, addLabel, removeLabel, childLabel, value?: ChildEntry[], onChange: (v: ChildEntry[]) => void, onNext: () => void }`

`childLabel` und `removeLabel` sind Vorlagen mit `{{index}}`, die der Flow schon übersetzt
übergibt — die Komponente bleibt frei von i18n-Schlüsseln, wie `QuestionCard` auch.

- [ ] **Step 1: Write the failing test**

`src/components/Eligibility/ChildrenCard.test.tsx`:

```ts
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChildrenCard } from "./ChildrenCard";

const baseProps = {
	id: "children",
	question: "Wann sind Deine Kinder geboren?",
	category: "Kinder im Haushalt",
	addLabel: "Kind hinzufügen",
	removeLabel: "Kind {{index}} entfernen",
	childLabel: "Kind {{index}}",
	onChange: vi.fn(),
	onNext: vi.fn(),
};

describe("ChildrenCard", () => {
	it("starts with one empty row so no extra click is needed", () => {
		render(<ChildrenCard {...baseProps} />);
		expect(screen.getAllByTestId(/^child-date-/)).toHaveLength(1);
	});

	it("adds a row", () => {
		render(<ChildrenCard {...baseProps} />);
		fireEvent.click(screen.getByTestId("add-child"));
		expect(screen.getAllByTestId(/^child-date-/)).toHaveLength(2);
	});

	it("removes a row", () => {
		render(<ChildrenCard {...baseProps} />);
		fireEvent.click(screen.getByTestId("add-child"));
		fireEvent.click(screen.getByTestId("remove-child-1"));
		expect(screen.getAllByTestId(/^child-date-/)).toHaveLength(1);
	});

	it("labels each row with its number", () => {
		render(<ChildrenCard {...baseProps} />);
		fireEvent.click(screen.getByTestId("add-child"));
		expect(screen.getByText("Kind 1")).toBeInTheDocument();
		expect(screen.getByText("Kind 2")).toBeInTheDocument();
	});

	it("names the child in the remove button's accessible label", () => {
		render(<ChildrenCard {...baseProps} />);
		expect(screen.getByTestId("remove-child-0")).toHaveAttribute(
			"aria-label",
			"Kind 1 entfernen",
		);
	});

	it("keeps the next button disabled while a row is empty", () => {
		render(<ChildrenCard {...baseProps} />);
		expect(screen.getByTestId("next-button")).toBeDisabled();
	});

	it("reports the filled rows and enables the next button", () => {
		const onChange = vi.fn();
		render(<ChildrenCard {...baseProps} onChange={onChange} />);
		fireEvent.change(screen.getByTestId("child-date-0"), {
			target: { value: "2019-04-02" },
		});
		expect(onChange).toHaveBeenCalledWith([{ dateOfBirth: "2019-04-02" }]);
		expect(screen.getByTestId("next-button")).not.toBeDisabled();
	});

	it("blocks the next button when a second row is added but left empty", () => {
		render(<ChildrenCard {...baseProps} value={[{ dateOfBirth: "2019-04-02" }]} />);
		fireEvent.click(screen.getByTestId("add-child"));
		expect(screen.getByTestId("next-button")).toBeDisabled();
	});

	it("renders the rows it is given", () => {
		render(
			<ChildrenCard
				{...baseProps}
				value={[{ dateOfBirth: "2019-04-02" }, { dateOfBirth: "2021-06-11" }]}
			/>,
		);
		expect(screen.getAllByTestId(/^child-date-/)).toHaveLength(2);
		expect(screen.getByTestId("child-date-1")).toHaveValue("2021-06-11");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Eligibility/ChildrenCard.test.tsx`
Expected: FAIL — `Failed to resolve import "./ChildrenCard"`

- [ ] **Step 3: Write minimal implementation**

`src/components/Eligibility/ChildrenCard.tsx`:

```tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";
import { PrimaryButton } from "../ui/PrimaryButton";
import { Info, Plus, X } from "lucide-react";
import type { ChildEntry } from "../../schemas/benefitCheck.schema";

interface ChildrenCardProps {
	id: string;
	question: string;
	category: string;
	tip?: string;
	/** Templates carrying {{index}}; already translated by the caller. */
	addLabel: string;
	removeLabel: string;
	childLabel: string;
	value?: ChildEntry[];
	onChange: (value: ChildEntry[]) => void;
	onNext: () => void;
}

const withIndex = (template: string, index: number): string =>
	template.replace("{{index}}", String(index + 1));

export const ChildrenCard: React.FC<ChildrenCardProps> = ({
	id,
	question,
	category,
	tip,
	addLabel,
	removeLabel,
	childLabel,
	value,
	onChange,
	onNext,
}) => {
	const { t } = useTranslation();
	const legendRef = useRef<HTMLLegendElement>(null);

	// One empty row to start, so a parent with one child types straight away.
	const [rows, setRows] = useState<string[]>(() =>
		value && value.length > 0 ? value.map((c) => c.dateOfBirth) : [""],
	);

	useEffect(() => {
		legendRef.current?.focus();
	}, [id]);

	const maxDate = useMemo(() => new Date().toLocaleDateString("sv-SE"), []);

	const publish = (next: string[]) => {
		setRows(next);
		// Empty rows are dropped, so an accidentally added row does not become data.
		onChange(
			next.filter((d) => d !== "").map((dateOfBirth) => ({ dateOfBirth })),
		);
	};

	const isComplete = rows.length > 0 && rows.every((d) => d !== "");

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (isComplete) {
			onNext();
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			data-testid="question-card"
			className="w-full font-sans flex flex-col justify-between flex-grow min-h-[360px]"
		>
			<fieldset className="w-full border-none p-0 m-0 flex flex-col gap-6 mb-8">
				<div className="flex flex-col gap-3">
					<p className="text-body text-brand-grey">
						{t(i18nKeys.eligibility.title)}
					</p>
					<h1 className="text-xl font-bold text-brand-black leading-snug">
						{category}
					</h1>
				</div>

				{tip && (
					<div
						id={`${id}-tip`}
						className="bg-brand-bg border border-brand-border/40 rounded-xl p-4 flex gap-2 items-start"
					>
						<Info
							className="size-5 text-brand-grey shrink-0 mt-0.5"
							aria-hidden="true"
						/>
						<p className="text-base text-brand-grey leading-snug whitespace-pre-line">
							{tip}
						</p>
					</div>
				)}

				<legend
					ref={legendRef}
					tabIndex={-1}
					id={`${id}-legend`}
					className="font-bold text-brand-black leading-snug focus:outline-none mb-2"
				>
					{question}
				</legend>

				<ul className="flex flex-col gap-4 w-full list-none p-0 m-0">
					{rows.map((dateOfBirth, index) => (
						// eslint-disable-next-line react/no-array-index-key
						<li key={index} className="flex flex-col gap-2">
							<label
								htmlFor={`${id}-child-${index}`}
								className="text-base text-brand-black"
							>
								{withIndex(childLabel, index)}
							</label>
							<div className="flex items-center gap-2">
								<input
									id={`${id}-child-${index}`}
									type="date"
									aria-describedby={tip ? `${id}-tip` : undefined}
									data-testid={`child-date-${index}`}
									value={dateOfBirth}
									min="1900-01-01"
									max={maxDate}
									onChange={(event) => {
										const next = [...rows];
										next[index] = event.target.validity.valid
											? event.target.value
											: "";
										publish(next);
									}}
									className="h-12 flex-1 px-3 rounded-xl border-2 border-brand-border/30 text-base text-brand-black bg-white focus:outline-none focus:border-brand-primary"
								/>
								{rows.length > 1 && (
									<button
										type="button"
										aria-label={withIndex(removeLabel, index)}
										data-testid={`remove-child-${index}`}
										onClick={() =>
											publish(rows.filter((_, i) => i !== index))
										}
										className="size-12 shrink-0 rounded-xl border-2 border-brand-border/30 flex items-center justify-center text-brand-grey"
									>
										<X className="size-5" aria-hidden="true" />
									</button>
								)}
							</div>
						</li>
					))}
				</ul>

				<button
					type="button"
					data-testid="add-child"
					onClick={() => publish([...rows, ""])}
					className="flex items-center gap-2 text-base font-bold text-brand-black self-start"
				>
					<Plus className="size-5" aria-hidden="true" />
					{addLabel}
				</button>
			</fieldset>

			<div className="w-full">
				<PrimaryButton
					type="submit"
					disabled={!isComplete}
					data-testid="next-button"
				>
					{t(i18nKeys.common.next)}
				</PrimaryButton>
			</div>
		</form>
	);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Eligibility/ChildrenCard.test.tsx`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/Eligibility/ChildrenCard.tsx src/components/Eligibility/ChildrenCard.test.tsx
git commit -m "$(cat <<'EOF'
feat: add ChildrenCard for the children's dates of birth

Starts with one empty row so a parent with one child can type straight away, and
drops empty rows on publish so an accidentally added row does not become data.
Next stays disabled while any visible row is empty.

Every row carries a visible number, and the remove buttons name the child in their
accessible label — without that the list cannot be operated with a screen reader.

Uses a native date input with min/max like DateOfBirthCard rather than separate
day/month/year fields.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Copy

**Files:**
- Modify: `src/locales/de/eligibility.json`
- Modify: `src/locales/en/eligibility.json`
- Test: `src/store/benefits/questionCopy.test.ts`

**Interfaces:**
- Consumes: `QUESTION_CATALOGUE` (Task 2)
- Produces: i18n-Schlüssel `questions.<id>.{category,title,tip}` und, für `choice`/`boolean`, `questions.<id>.options.<OPTION>`; dazu `questions.children.{add,remove,child_label}` und `questions.<id>.unit` für Zahlenfragen

- [ ] **Step 1: Write the failing test**

Dieser Test hält die Copy und den Katalog dauerhaft zusammen — fehlt ein Schlüssel,
schlägt er fehl, statt dass der Nutzer einen rohen i18n-Key sieht.

`src/store/benefits/questionCopy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import de from "../../locales/de/eligibility.json";
import en from "../../locales/en/eligibility.json";
import { BINARY_OPTIONS, QUESTION_CATALOGUE } from "./questionCatalogue";

const LOCALES = { de, en } as Record<string, Record<string, unknown>>;

const questionsOf = (locale: string): Record<string, Record<string, unknown>> =>
	LOCALES[locale].questions as Record<string, Record<string, unknown>>;

describe.each(["de", "en"])("question copy (%s)", (locale) => {
	const questions = questionsOf(locale);

	it("has category, title and tip for every question", () => {
		for (const question of QUESTION_CATALOGUE) {
			const block = questions[question.id];
			expect(block, `${question.id} missing`).toBeDefined();
			for (const key of ["category", "title", "tip"]) {
				expect(typeof block[key], `${question.id}.${key}`).toBe("string");
				expect((block[key] as string).length, `${question.id}.${key}`)
					.toBeGreaterThan(0);
			}
		}
	});

	it("has a label for every option of every choice and boolean question", () => {
		for (const question of QUESTION_CATALOGUE) {
			if (question.input !== "choice" && question.input !== "boolean") {
				continue;
			}
			const options = question.options ?? BINARY_OPTIONS;
			const labels = questions[question.id].options as Record<string, string>;
			expect(labels, `${question.id}.options`).toBeDefined();
			for (const option of options) {
				expect(typeof labels[option], `${question.id}.options.${option}`).toBe(
					"string",
				);
			}
		}
	});

	it("has a unit label for every number question", () => {
		for (const question of QUESTION_CATALOGUE) {
			if (question.input === "number") {
				expect(typeof questions[question.id].unit, `${question.id}.unit`).toBe(
					"string",
				);
			}
		}
	});

	it("has the children list labels", () => {
		const block = questions.children;
		for (const key of ["add", "remove", "child_label"]) {
			expect(typeof block[key], `children.${key}`).toBe("string");
		}
		expect(block.remove as string).toContain("{{index}}");
		expect(block.child_label as string).toContain("{{index}}");
	});

	it("carries no copy for questions that no longer exist", () => {
		const known = new Set(QUESTION_CATALOGUE.map((q) => q.id));
		for (const id of Object.keys(questions)) {
			expect(known.has(id), `stale copy block: ${id}`).toBe(true);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/benefits/questionCopy.test.ts`
Expected: FAIL — die alten Blöcke `nationality`, `livesInGermany`, `pension`, `income`,
`hasAssetsAboveThreshold` sind veraltet, und die 13 neuen fehlen.

- [ ] **Step 3: Deutsche Copy schreiben**

In `src/locales/de/eligibility.json` den kompletten `questions`-Block ersetzen:

```json
	"questions": {
		"household": {
			"category": "Haushalt",
			"title": "Wer lebt in Deinem Haushalt?",
			"tip": "Wie viele Menschen zusammenleben, verändert die Berechnung. Kinder zählen mit.",
			"options": {
				"SINGLE": "Ich lebe allein.",
				"SINGLE_PARENT": "Ich bin alleinerziehend.",
				"COUPLE_NO_CHILDREN": "Wir sind ein Paar, ohne Kinder im Haushalt.",
				"COUPLE_WITH_CHILDREN": "Wir sind ein Paar, mit Kindern im Haushalt."
			}
		},
		"children": {
			"category": "Kinder im Haushalt",
			"title": "Wann sind Deine Kinder geboren?",
			"tip": "Das Alter der Kinder ist wichtig, weil für Kinder eigene Beträge gelten. Manche Leistungen gibt es nur für Kinder unter 18 oder unter 25 Jahren.",
			"add": "Kind hinzufügen",
			"remove": "Kind {{index}} entfernen",
			"child_label": "Kind {{index}}"
		},
		"birthdate": {
			"category": "Geburtsdatum",
			"title": "Wann bist Du geboren?",
			"tip": "Dein Alter entscheidet mit, welche Leistungen für Dich infrage kommen. Ab der Regelaltersgrenze gelten andere Regeln als davor."
		},
		"germany": {
			"category": "Wohnsitz",
			"title": "Wohnst Du in Deutschland?",
			"tip": "Die Leistungen, die Klaro prüft, gibt es nur, wenn Du dauerhaft in Deutschland lebst.",
			"options": {
				"YES": "Ja, ich wohne in Deutschland.",
				"NO": "Nein, ich wohne nicht in Deutschland."
			}
		},
		"work-capacity": {
			"category": "Arbeiten können",
			"title": "Kannst Du mindestens drei Stunden am Tag arbeiten?",
			"tip": "Drei Stunden sind eine Grenze im Gesetz. Danach richtet sich, welche Stelle für Dich zuständig ist. Es geht nicht darum, ob Du gerade eine Arbeit hast.",
			"options": {
				"FULL": "Ja, mindestens drei Stunden am Tag.",
				"TEMPORARILY_REDUCED": "Im Moment nicht, aber vielleicht später wieder.",
				"PERMANENTLY_REDUCED": "Nein, dauerhaft nicht."
			}
		},
		"employment": {
			"category": "Arbeit",
			"title": "Arbeitest Du im Moment?",
			"tip": "Wenn Du mit einem Partner oder einer Partnerin zusammenlebst, zählt dessen Arbeit auch dazu.",
			"options": {
				"YES": "Ja, ich arbeite.",
				"NO": "Nein, im Moment nicht."
			}
		},
		"gross-income": {
			"category": "Arbeit",
			"title": "Wie hoch ist das Bruttoeinkommen im Monat?",
			"tip": "Brutto heißt: der Betrag vor Steuern und Abgaben. Du findest ihn auf der Lohnabrechnung. Lebst Du mit einem Partner oder einer Partnerin zusammen, rechne beides zusammen.",
			"unit": "Euro"
		},
		"net-income": {
			"category": "Einkommen",
			"title": "Wie viel Geld hat Dein Haushalt im Monat insgesamt?",
			"tip": "Zähle alles zusammen, was jeden Monat reinkommt: Lohn nach Abzügen, Rente, Kindergeld, Unterhalt, andere Leistungen. Ein ungefährer Betrag genügt.",
			"unit": "Euro"
		},
		"warm-rent": {
			"category": "Wohnen",
			"title": "Wie hoch ist Deine Warmmiete im Monat?",
			"tip": "Warmmiete heißt: Miete plus Nebenkosten plus Heizkosten. Der Betrag steht in Deinem Mietvertrag oder auf dem Kontoauszug.",
			"unit": "Euro"
		},
		"assets": {
			"category": "Ersparnisse",
			"title": "Wie viel Geld hast Du gespart?",
			"tip": "Gemeint ist alles, was Du zurückgelegt hast: Konto, Sparbuch, Bargeld, Wertpapiere. Einen Teil darfst Du behalten — wie viel, hängt von Deinem Alter ab. Eine grobe Schätzung genügt.",
			"options": {
				"UNDER_5000": "Weniger als 5.000 Euro.",
				"FROM_5000_TO_15000": "Zwischen 5.000 und 15.000 Euro.",
				"FROM_15000_TO_25000": "Zwischen 15.000 und 25.000 Euro.",
				"OVER_25000": "Mehr als 25.000 Euro."
			}
		},
		"benefits": {
			"category": "Laufende Leistungen",
			"title": "Bekommst Du schon eine Sozialleistung?",
			"tip": "Gemeint sind zum Beispiel Grundsicherungsgeld, Grundsicherung im Alter oder Hilfe zum Lebensunterhalt. Manche Leistungen kann man nicht gleichzeitig bekommen.",
			"options": {
				"YES": "Ja, ich bekomme schon eine Leistung.",
				"NO": "Nein, im Moment nicht."
			}
		},
		"citizenship": {
			"category": "Staatsangehörigkeit",
			"title": "Hast Du die deutsche Staatsangehörigkeit oder die eines EU-Landes?",
			"tip": "Je nach Staatsangehörigkeit und Aufenthaltsstatus gelten unterschiedliche Gesetze.",
			"options": {
				"DE_EU": "Ja, deutsch oder aus einem EU-Land.",
				"NON_EU": "Nein, aus einem anderen Land."
			}
		},
		"residence-status": {
			"category": "Aufenthalt",
			"title": "Hast Du einen gesicherten Aufenthaltstitel?",
			"tip": "Gesichert heißt zum Beispiel: Niederlassungserlaubnis, unbefristete Aufenthaltserlaubnis oder Anerkennung als Flüchtling. Bist Du noch im Asylverfahren, gibt es ein eigenes System — Klaro weist Dich am Ende darauf hin.",
			"options": {
				"YES": "Ja, ich habe einen gesicherten Aufenthaltstitel.",
				"NO": "Nein, oder ich bin mir nicht sicher."
			}
		},
		"child-support": {
			"category": "Unterhalt",
			"title": "Bekommt Dein Kind Unterhalt vom anderen Elternteil?",
			"tip": "Wird kein oder zu wenig Unterhalt gezahlt, kann der Staat einspringen. Das heißt Unterhaltsvorschuss.",
			"options": {
				"YES": "Ja, den vollen Unterhalt.",
				"NO": "Nein, oder nur einen Teil."
			}
		},
		"support-duration": {
			"category": "Unterhalt",
			"title": "Seit wie vielen Monaten fehlt der Unterhalt?",
			"tip": "Eine ungefähre Zahl genügt. Wenn Du es nicht genau weißt, schätze.",
			"unit": "Monate"
		}
	},
```

- [ ] **Step 4: Englische Copy schreiben**

In `src/locales/en/eligibility.json` denselben Block, gleiche Struktur:

```json
	"questions": {
		"household": {
			"category": "Household",
			"title": "Who lives in your household?",
			"tip": "How many people live together changes the calculation. Children count too.",
			"options": {
				"SINGLE": "I live alone.",
				"SINGLE_PARENT": "I am a single parent.",
				"COUPLE_NO_CHILDREN": "We are a couple, without children in the household.",
				"COUPLE_WITH_CHILDREN": "We are a couple, with children in the household."
			}
		},
		"children": {
			"category": "Children in the household",
			"title": "When were your children born?",
			"tip": "Your children's ages matter, because separate amounts apply to children. Some benefits only exist for children under 18 or under 25.",
			"add": "Add a child",
			"remove": "Remove child {{index}}",
			"child_label": "Child {{index}}"
		},
		"birthdate": {
			"category": "Date of birth",
			"title": "When were you born?",
			"tip": "Your age helps decide which benefits might be right for you. Different rules apply once you reach the statutory retirement age."
		},
		"germany": {
			"category": "Place of residence",
			"title": "Do you live in Germany?",
			"tip": "The benefits Klaro checks only exist if you live in Germany permanently.",
			"options": {
				"YES": "Yes, I live in Germany.",
				"NO": "No, I do not live in Germany."
			}
		},
		"work-capacity": {
			"category": "Ability to work",
			"title": "Can you work at least three hours a day?",
			"tip": "Three hours is a threshold in the law. It decides which office is responsible for you. This is not about whether you currently have a job.",
			"options": {
				"FULL": "Yes, at least three hours a day.",
				"TEMPORARILY_REDUCED": "Not at the moment, but perhaps again later.",
				"PERMANENTLY_REDUCED": "No, not permanently."
			}
		},
		"employment": {
			"category": "Work",
			"title": "Are you working at the moment?",
			"tip": "If you live with a partner, their work counts as well.",
			"options": {
				"YES": "Yes, I am working.",
				"NO": "No, not at the moment."
			}
		},
		"gross-income": {
			"category": "Work",
			"title": "How much is the gross monthly income?",
			"tip": "Gross means the amount before tax and contributions. You can find it on your payslip. If you live with a partner, add both together.",
			"unit": "Euro"
		},
		"net-income": {
			"category": "Income",
			"title": "How much money does your household have per month in total?",
			"tip": "Add up everything that comes in each month: wages after deductions, pension, child benefit, maintenance, other benefits. An approximate amount is enough.",
			"unit": "Euro"
		},
		"warm-rent": {
			"category": "Housing",
			"title": "How much is your rent per month, including bills?",
			"tip": "That means rent plus service charges plus heating. You can find the amount in your tenancy agreement or on your bank statement.",
			"unit": "Euro"
		},
		"assets": {
			"category": "Savings",
			"title": "How much money have you saved?",
			"tip": "This means everything you have put aside: accounts, savings books, cash, securities. You are allowed to keep some of it — how much depends on your age. A rough estimate is enough.",
			"options": {
				"UNDER_5000": "Less than 5,000 euros.",
				"FROM_5000_TO_15000": "Between 5,000 and 15,000 euros.",
				"FROM_15000_TO_25000": "Between 15,000 and 25,000 euros.",
				"OVER_25000": "More than 25,000 euros."
			}
		},
		"benefits": {
			"category": "Benefits you already receive",
			"title": "Are you already receiving a social benefit?",
			"tip": "For example Grundsicherungsgeld, Grundsicherung im Alter or Hilfe zum Lebensunterhalt. Some benefits cannot be received at the same time.",
			"options": {
				"YES": "Yes, I already receive a benefit.",
				"NO": "No, not at the moment."
			}
		},
		"citizenship": {
			"category": "Citizenship",
			"title": "Do you hold German citizenship or that of an EU country?",
			"tip": "Different laws apply depending on your citizenship and residence status.",
			"options": {
				"DE_EU": "Yes, German or from an EU country.",
				"NON_EU": "No, from another country."
			}
		},
		"residence-status": {
			"category": "Residence",
			"title": "Do you have secure residence status?",
			"tip": "Secure means, for example: a settlement permit, an open-ended residence permit, or recognition as a refugee. If your asylum procedure is still running, a separate system applies — Klaro will point you to it at the end.",
			"options": {
				"YES": "Yes, I have secure residence status.",
				"NO": "No, or I am not sure."
			}
		},
		"child-support": {
			"category": "Maintenance",
			"title": "Does your child receive maintenance from the other parent?",
			"tip": "If no maintenance or too little is paid, the state can step in. That is called Unterhaltsvorschuss.",
			"options": {
				"YES": "Yes, the full amount.",
				"NO": "No, or only part of it."
			}
		},
		"support-duration": {
			"category": "Maintenance",
			"title": "For how many months has the maintenance been missing?",
			"tip": "An approximate number is enough. If you are not sure, estimate.",
			"unit": "Months"
		}
	},
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/store/benefits/questionCopy.test.ts`
Expected: PASS — 10 tests (5 pro Sprache)

Run: `python3 -c "import json;[json.load(open(f'src/locales/{l}/eligibility.json')) for l in ('de','en')];print('JSON ok')"`
Expected: `JSON ok`

- [ ] **Step 6: Commit**

```bash
git add src/locales/de/eligibility.json src/locales/en/eligibility.json src/store/benefits/questionCopy.test.ts
git commit -m "$(cat <<'EOF'
feat: add copy for the fifteen benefit check questions

Keeps the existing structure and voice: a category heading, the question itself, a
tip explaining why it is being asked, and options written as full first-person
sentences.

A test holds the copy and the catalogue together, so a missing key fails the suite
instead of showing a raw i18n key to someone applying for benefits. It also fails
on stale blocks, which is how the four questions that no longer exist get caught.

The copy is a proposal and needs human review before it reaches users.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Flow, Navigation, Fortschritt

**Files:**
- Create: `src/hooks/useBenefitCheckNavigation.ts`
- Modify: `src/views/EligibilityFlow.tsx`
- Modify: `src/components/Eligibility/ProgressBar.tsx`
- Test: `src/views/EligibilityFlow.test.tsx`

**Interfaces:**
- Consumes: `QUESTION_CATALOGUE`, `BINARY_OPTIONS` (Task 2); `getValidPath`, `activeQuestions`, `questionById` (Task 3); `useBenefitCheckStore` (Task 4); `NumberCard` (Task 5); `ChildrenCard` (Task 6); Copy (Task 7)
- Produces: `useBenefitCheckNavigation()` → `{ question, indexInPath, pathLength, totalActive, navigateNext, navigateBack }`

- [ ] **Step 1: Write the failing test**

`src/views/EligibilityFlow.test.tsx`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EligibilityFlow } from "./EligibilityFlow";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import { HouseholdComposition } from "../schemas/benefitCheck.schema";

const renderAt = (questionId: string) =>
	render(
		<MemoryRouter initialEntries={[`/eligibility-check/${questionId}`]}>
			<Routes>
				<Route
					path="/eligibility-check/:questionId"
					element={<EligibilityFlow />}
				/>
				<Route path="*" element={<div data-testid="elsewhere" />} />
			</Routes>
		</MemoryRouter>,
	);

describe("EligibilityFlow", () => {
	beforeEach(() => {
		useBenefitCheckStore.getState().resetForm();
	});

	it("renders the first question as a choice card", () => {
		renderAt("household");
		expect(screen.getByTestId("question-card")).toBeInTheDocument();
		expect(screen.getByTestId("option-single")).toBeInTheDocument();
	});

	it("stores a choice answer", () => {
		renderAt("household");
		fireEvent.click(screen.getByTestId("option-single"));
		expect(useBenefitCheckStore.getState().answers.householdComposition).toBe(
			HouseholdComposition.SINGLE,
		);
	});

	it("maps the binary options of a boolean question onto true and false", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		useBenefitCheckStore.getState().setAnswer("dateOfBirth", "1994-01-15");
		renderAt("germany");
		fireEvent.click(screen.getByTestId("option-yes"));
		expect(useBenefitCheckStore.getState().answers.livesInGermany).toBe(true);
	});

	it("renders a number question with its unit", () => {
		const store = useBenefitCheckStore.getState();
		store.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		store.setAnswer("dateOfBirth", "1994-01-15");
		store.setAnswer("livesInGermany", true);
		store.setAnswer("workCapacity", "FULL");
		store.setAnswer("isEmployed", false);
		renderAt("net-income");
		expect(screen.getByTestId("number-input")).toBeInTheDocument();
		expect(screen.getByText("Euro")).toBeInTheDocument();
	});

	it("renders the children question as a list", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("householdComposition", HouseholdComposition.SINGLE_PARENT);
		renderAt("children");
		expect(screen.getByTestId("child-date-0")).toBeInTheDocument();
		expect(screen.getByTestId("add-child")).toBeInTheDocument();
	});

	it("redirects away from a question that the answers skip", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		renderAt("children");
		expect(screen.getByTestId("elsewhere")).toBeInTheDocument();
	});

	it("redirects away from an unknown question id", () => {
		renderAt("nope");
		expect(screen.getByTestId("elsewhere")).toBeInTheDocument();
	});

	it("shows the progress denominator from the active path", () => {
		useBenefitCheckStore
			.getState()
			.setAnswer("householdComposition", HouseholdComposition.SINGLE);
		renderAt("birthdate");
		// A single person skips the three child questions: 15 - 3 = 12.
		expect(screen.getByText(/2.*12/)).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/EligibilityFlow.test.tsx`
Expected: FAIL — `EligibilityFlow` importiert noch den alten Store und die alte Navigation.

- [ ] **Step 3: Navigation schreiben**

`src/hooks/useBenefitCheckNavigation.ts`:

```ts
import { useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import {
	activeQuestions,
	getValidPath,
	questionById,
} from "../store/benefits/questionPath";
import { compositionImpliesChildren } from "../store/benefits/derive";
import { AppRoutes, getEligibilityRoute } from "../constants/routes";

/** Input-side clock only; the engine always receives `today` explicitly. */
const todayIsoDate = (): string => new Date().toLocaleDateString("sv-SE");

export const useBenefitCheckNavigation = () => {
	const navigate = useNavigate();
	const { questionId } = useParams<{ questionId: string }>();
	const answers = useBenefitCheckStore((s) => s.answers);
	const setAnswer = useBenefitCheckStore((s) => s.setAnswer);
	const today = todayIsoDate();

	const question = useMemo(
		() => (questionId ? questionById(questionId) : undefined),
		[questionId],
	);
	const path = useMemo(() => getValidPath(answers, today), [answers, today]);
	const totalActive = useMemo(
		() => activeQuestions(answers, today).length,
		[answers, today],
	);
	const indexInPath = useMemo(
		() => path.findIndex((q) => q.id === questionId),
		[path, questionId],
	);

	/**
	 * The children question is the one skip that still has to write. Every rule's means
	 * test needs `children`, so a childless household that never sees the question would
	 * otherwise sit on INSUFFICIENT_DATA forever. Answering question 1 with a childless
	 * composition fully determines the answer to question 2, so it is recorded here.
	 */
	const recordSkippedChildren = useCallback(() => {
		if (
			answers.householdComposition !== undefined &&
			!compositionImpliesChildren(answers.householdComposition) &&
			answers.children === undefined
		) {
			setAnswer("children", []);
		}
	}, [answers.householdComposition, answers.children, setAnswer]);

	const navigateNext = useCallback(() => {
		recordSkippedChildren();
		const remaining = activeQuestions(answers, today);
		const currentIndex = remaining.findIndex((q) => q.id === questionId);
		const next = remaining[currentIndex + 1];
		if (!next) {
			navigate(AppRoutes.EligibilityResult);
			return;
		}
		useBenefitCheckStore.getState().recordStepReached(currentIndex + 2);
		navigate(getEligibilityRoute(next.id));
	}, [answers, questionId, today, navigate, recordSkippedChildren]);

	const navigateBack = useCallback(() => {
		if (indexInPath > 0) {
			navigate(getEligibilityRoute(path[indexInPath - 1].id));
			return;
		}
		navigate(AppRoutes.Home);
	}, [indexInPath, path, navigate]);

	return {
		question,
		indexInPath,
		path,
		totalActive,
		navigateNext,
		navigateBack,
	};
};
```

- [ ] **Step 4: ProgressBar auf einen übergebenen Nenner umstellen**

`src/components/Eligibility/ProgressBar.tsx` — den Store-Zugriff durch eine Prop
ersetzen, damit die Komponente nicht mehr an einen bestimmten Store gebunden ist:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";
import { ProgressBar as SharedProgressBar } from "../ui/ProgressBar";

interface ProgressBarProps {
	current: number;
	total: number;
	/** Highest step reached so far, so the bar never runs backwards. */
	maxDepthReached: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
	current,
	total,
	maxDepthReached,
}) => {
	const { t } = useTranslation();
	const visualDepth = Math.max(current, maxDepthReached);
	const progressText = t(i18nKeys.eligibility.progressAria, { current, total });

	return (
		<div className="w-full mb-6 font-sans flex flex-col gap-3">
			<SharedProgressBar
				current={visualDepth}
				total={total}
				colorVariant="blue"
				ariaLabel={progressText}
			/>
			<p className="text-base text-brand-grey">{progressText}</p>
		</div>
	);
};
```

- [ ] **Step 5: Flow-Ansicht schreiben**

`src/views/EligibilityFlow.tsx` vollständig ersetzen:

```tsx
import React, { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import { ProgressBar } from "../components/Eligibility/ProgressBar";
import { QuestionCard } from "../components/Eligibility/QuestionCard";
import { DateOfBirthCard } from "../components/Eligibility/DateOfBirthCard";
import { NumberCard } from "../components/Eligibility/NumberCard";
import { ChildrenCard } from "../components/Eligibility/ChildrenCard";
import { StepLayout } from "../components/Layout/StepLayout";
import { AppRoutes, getEligibilityRoute } from "../constants/routes";
import { useBenefitCheckNavigation } from "../hooks/useBenefitCheckNavigation";
import { BINARY_OPTIONS } from "../store/benefits/questionCatalogue";
import { i18nKeys } from "../i18n/i18nKeys";
import type { BenefitCheckAnswers } from "../schemas/benefitCheck.schema";

export const EligibilityFlow: React.FC = () => {
	const { t } = useTranslation();
	const answers = useBenefitCheckStore((s) => s.answers);
	const setAnswer = useBenefitCheckStore((s) => s.setAnswer);
	const clearAnswer = useBenefitCheckStore((s) => s.clearAnswer);
	const validationError = useBenefitCheckStore((s) => s.validationError);
	const maxDepthReached = useBenefitCheckStore((s) => s.maxDepthReached);
	const {
		question,
		indexInPath,
		path,
		totalActive,
		navigateNext,
		navigateBack,
	} = useBenefitCheckNavigation();

	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		window.scrollTo(0, 0);
		containerRef.current?.focus();
	}, [question?.id]);

	// Unknown id, or a question the current answers skip: fall back to the first
	// question the path still offers.
	if (!question || indexInPath === -1) {
		return <Navigate to={getEligibilityRoute(path[0].id)} replace />;
	}

	const copy = (part: string) => t(`questions.${question.id}.${part}`);
	const tipText = t(`questions.${question.id}.tip`, { defaultValue: "" });

	const header = {
		id: question.id,
		question: copy("title"),
		category: copy("category"),
		tip: tipText || undefined,
	};

	const write = <K extends keyof BenefitCheckAnswers>(
		value: BenefitCheckAnswers[K],
	) => setAnswer(question.field as K, value);

	return (
		<div
			ref={containerRef}
			tabIndex={-1}
			className="outline-none w-full flex flex-col items-center min-h-full bg-white flex-grow"
		>
			<StepLayout
				onBack={navigateBack}
				backAriaLabel={t(i18nKeys.common.back)}
				backTestId="back-button"
				colorVariant="blue"
			>
				<ProgressBar
					current={indexInPath + 1}
					total={totalActive}
					maxDepthReached={maxDepthReached}
				/>

				{validationError && (
					<div
						className="mb-4 w-full rounded-lg border border-red-200 bg-red-100 p-4 text-sm text-red-700 shadow-sm"
						role="alert"
					>
						{validationError}
					</div>
				)}

				{question.input === "choice" && (
					<QuestionCard
						key={question.id}
						{...header}
						options={question.options ?? []}
						value={answers[question.field] as string | undefined}
						onChange={(raw) => write(raw as never)}
						onNext={navigateNext}
					/>
				)}

				{question.input === "boolean" && (
					<QuestionCard
						key={question.id}
						{...header}
						options={BINARY_OPTIONS}
						value={
							answers[question.field] === undefined
								? undefined
								: answers[question.field]
									? "YES"
									: "NO"
						}
						onChange={(raw) => write((raw === "YES") as never)}
						onNext={navigateNext}
					/>
				)}

				{question.input === "date" && (
					<DateOfBirthCard
						key={question.id}
						{...header}
						value={answers[question.field] as string | undefined}
						onChange={(raw) => write(raw as never)}
						onClear={() => clearAnswer(question.field)}
						onNext={navigateNext}
					/>
				)}

				{question.input === "number" && (
					<NumberCard
						key={question.id}
						{...header}
						unitLabel={copy("unit")}
						value={answers[question.field] as number | undefined}
						onChange={(raw) => write(raw as never)}
						onClear={() => clearAnswer(question.field)}
						onNext={navigateNext}
					/>
				)}

				{question.input === "children" && (
					<ChildrenCard
						key={question.id}
						{...header}
						addLabel={copy("add")}
						removeLabel={copy("remove")}
						childLabel={copy("child_label")}
						value={answers.children}
						onChange={(raw) => write(raw as never)}
						onNext={navigateNext}
					/>
				)}
			</StepLayout>
		</div>
	);
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/views/EligibilityFlow.test.tsx`
Expected: PASS — 8 tests

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useBenefitCheckNavigation.ts src/views/EligibilityFlow.tsx src/components/Eligibility/ProgressBar.tsx src/views/EligibilityFlow.test.tsx
git commit -m "$(cat <<'EOF'
feat: drive the questionnaire flow from the catalogue

The view now renders whichever of the five input kinds a question declares, so
adding a question is a catalogue entry plus copy rather than a code change. The
progress denominator comes from the active path, and ProgressBar takes
maxDepthReached as a prop instead of reaching into a specific store.

The children question is the one skip that still writes. Every means test needs
`children`, so a childless household that never sees the question would sit on
INSUFFICIENT_DATA forever — and answering question 1 with a childless composition
already determines the answer, so the navigation records it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Übergangslösung und Aufräumen

**Files:**
- Modify: `src/views/EligibilityResult.tsx`
- Modify: `src/services/application.service.ts`, `src/services/application.service.test.ts`
- Modify: `src/views/AuthView.tsx`, `src/views/EligibilityStart.tsx`, `src/store/useRootStore.ts`
- Delete: `src/schemas/eligibility.schema.ts`, `src/store/EligibilityEngine.ts`, `src/store/EligibilityEngine.test.ts`, `src/store/useEligibilityStore.ts`, `src/store/useEligibilityStore.test.ts`, `src/hooks/useEligibilityNavigation.ts`, `src/hooks/useEligibilityOutcome.ts`

**Interfaces:**
- Consumes: `evaluateBenefitCheck` (Teil A), `useBenefitCheckStore` (Task 4)
- Produces: `mapEligibilityToProfilePayload(answers: PartialBenefitCheckAnswers): Record<string, unknown>`

- [ ] **Step 1: Write the failing test**

`src/services/application.service.test.ts` — den bestehenden Test durch diesen ersetzen:

```ts
import { describe, expect, it } from "vitest";
import {
	AssetsBand,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../schemas/benefitCheck.schema";
import { mapEligibilityToProfilePayload } from "./application.service";

describe("mapEligibilityToProfilePayload", () => {
	it("is empty for an empty answer set", () => {
		expect(mapEligibilityToProfilePayload({})).toEqual({});
	});

	it("maps the date of birth straight through", () => {
		expect(
			mapEligibilityToProfilePayload({ dateOfBirth: "1994-01-15" }),
		).toEqual({ date_of_birth: "1994-01-15" });
	});

	it("maps residence in Germany to a boolean", () => {
		expect(mapEligibilityToProfilePayload({ livesInGermany: true })).toEqual({
			is_resident_in_germany: true,
		});
	});

	it("maps EU citizenship onto the three profile fields", () => {
		expect(
			mapEligibilityToProfilePayload({ citizenship: Citizenship.DE_EU }),
		).toEqual({
			is_german_citizen: true,
			nationality: "DE",
			residence_status: "Citizen",
		});
	});

	it("maps non-EU citizenship with secure status", () => {
		expect(
			mapEligibilityToProfilePayload({
				citizenship: Citizenship.NON_EU,
				hasSecureResidenceStatus: true,
			}),
		).toEqual({
			is_german_citizen: false,
			residence_status: "PermanentResident",
		});
	});

	it("maps work capacity onto ability_to_work", () => {
		expect(
			mapEligibilityToProfilePayload({
				workCapacity: WorkCapacity.PERMANENTLY_REDUCED,
			}),
		).toEqual({
			ability_to_work: "Permanently disabled",
			has_permanent_reduction_in_earning_capacity: true,
		});
		expect(
			mapEligibilityToProfilePayload({ workCapacity: WorkCapacity.FULL }),
		).toEqual({ ability_to_work: "Fully able" });
	});

	it("maps the asset band onto the has_assets boolean", () => {
		expect(
			mapEligibilityToProfilePayload({ assetsBand: AssetsBand.UNDER_5000 }),
		).toEqual({ has_assets: false });
		expect(
			mapEligibilityToProfilePayload({
				assetsBand: AssetsBand.FROM_5000_TO_15000,
			}),
		).toEqual({ has_assets: true });
	});

	it("maps the household composition onto marital status and head count", () => {
		expect(
			mapEligibilityToProfilePayload({
				householdComposition: HouseholdComposition.SINGLE,
				children: [],
			}),
		).toEqual({ marital_status: "Single", persons_in_household_count: 1 });
	});

	it("counts children into the household size", () => {
		expect(
			mapEligibilityToProfilePayload({
				householdComposition: HouseholdComposition.COUPLE_WITH_CHILDREN,
				children: [{ dateOfBirth: "2019-04-02" }],
			}),
		).toEqual({ marital_status: "Cohabiting", persons_in_household_count: 3 });
	});

	it("maps the net household income", () => {
		expect(
			mapEligibilityToProfilePayload({ monthlyNetHouseholdIncome: 1100 }),
		).toEqual({ monthly_income: 1100 });
	});

	it("does not send the four fields the profile schema has no column for", () => {
		const payload = mapEligibilityToProfilePayload({
			monthlyGrossIncome: 1400,
			assetsBand: AssetsBand.OVER_25000,
			childReceivesFullSupport: false,
			monthsWithoutChildSupport: 8,
			monthlyWarmRent: 650,
		});
		expect(payload).not.toHaveProperty("monthly_gross_income");
		expect(payload).not.toHaveProperty("assets_band");
		expect(payload).not.toHaveProperty("child_receives_full_support");
		expect(payload).not.toHaveProperty("months_without_child_support");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/application.service.test.ts`
Expected: FAIL — der Import aus `../schemas/benefitCheck.schema` trifft auf eine Funktion,
die noch `EligibilityCheck` erwartet.

- [ ] **Step 3: Mapping umstellen**

In `src/services/application.service.ts` den Import auf das neue Schema wechseln und
`mapEligibilityToProfilePayload` ersetzen:

```ts
import {
	AssetsBand,
	Citizenship,
	HouseholdComposition,
	WorkCapacity,
} from "../schemas/benefitCheck.schema";
import type { PartialBenefitCheckAnswers } from "../schemas/benefitCheck.schema";
```

```ts
const MARITAL_STATUS_BY_COMPOSITION: Record<HouseholdComposition, string> = {
	[HouseholdComposition.SINGLE]: "Single",
	[HouseholdComposition.SINGLE_PARENT]: "Single",
	[HouseholdComposition.COUPLE_NO_CHILDREN]: "Cohabiting",
	[HouseholdComposition.COUPLE_WITH_CHILDREN]: "Cohabiting",
};

const ABILITY_TO_WORK_BY_CAPACITY: Record<WorkCapacity, string> = {
	[WorkCapacity.FULL]: "Fully able",
	[WorkCapacity.TEMPORARILY_REDUCED]: "Temporarily disabled",
	[WorkCapacity.PERMANENTLY_REDUCED]: "Permanently disabled",
};

/**
 * Answers that reach the profile when a guest signs in.
 *
 * GAP: four answers have no column in UserProfileValidationSchema and are deliberately
 * left out — monthlyGrossIncome (monthly_income is documented as net),
 * assetsBand (only the has_assets boolean exists), childReceivesFullSupport and
 * monthsWithoutChildSupport (the existing fields mean paying support, not receiving it).
 * Sending them would return HTTP 200 and discard the data, because the schema sets no
 * extra="forbid" and Pydantic's default is extra="ignore". See part A's design, §9.
 *
 * GAP: monthlyWarmRent has no home either. rent_total, heating_costs and hot_water_costs
 * exist separately and a warm rent cannot be split back into them without inventing
 * numbers.
 */
export const mapEligibilityToProfilePayload = (
	answers: PartialBenefitCheckAnswers,
): Record<string, unknown> => {
	const payload: Record<string, unknown> = {};

	if (answers.dateOfBirth) {
		payload.date_of_birth = answers.dateOfBirth;
	}

	if (answers.livesInGermany !== undefined) {
		payload.is_resident_in_germany = answers.livesInGermany;
	}

	if (answers.citizenship === Citizenship.DE_EU) {
		payload.is_german_citizen = true;
		payload.nationality = "DE";
		payload.residence_status = "Citizen";
	} else if (answers.citizenship === Citizenship.NON_EU) {
		payload.is_german_citizen = false;
		if (answers.hasSecureResidenceStatus !== undefined) {
			payload.residence_status = answers.hasSecureResidenceStatus
				? "PermanentResident"
				: "Other";
		}
	}

	if (answers.workCapacity !== undefined) {
		payload.ability_to_work = ABILITY_TO_WORK_BY_CAPACITY[answers.workCapacity];
		if (answers.workCapacity === WorkCapacity.PERMANENTLY_REDUCED) {
			payload.has_permanent_reduction_in_earning_capacity = true;
		}
	}

	if (answers.assetsBand !== undefined) {
		payload.has_assets = answers.assetsBand !== AssetsBand.UNDER_5000;
	}

	if (answers.householdComposition !== undefined) {
		payload.marital_status =
			MARITAL_STATUS_BY_COMPOSITION[answers.householdComposition];
		const adults =
			answers.householdComposition ===
				HouseholdComposition.COUPLE_NO_CHILDREN ||
			answers.householdComposition === HouseholdComposition.COUPLE_WITH_CHILDREN
				? 2
				: 1;
		payload.persons_in_household_count =
			adults + (answers.children?.length ?? 0);
	}

	if (answers.monthlyNetHouseholdIncome !== undefined) {
		payload.monthly_income = answers.monthlyNetHouseholdIncome;
	}

	return payload;
};
```

Die `syncGuestData`-Signatur wird `answers: PartialBenefitCheckAnswers`.

**Nicht in Teil B:** `associated_persons` aus `children` zu bauen. Das Endpoint ersetzt die
Kollektion vollständig, weshalb es eine bewusste Merge-Regel braucht — Teil C.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/application.service.test.ts`
Expected: PASS — 11 tests

- [ ] **Step 5: Übergangs-Ergebnisansicht schreiben**

`src/views/EligibilityResult.tsx` vollständig ersetzen:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { StepLayout } from "../components/Layout/StepLayout";
import { useBenefitCheckStore } from "../store/useBenefitCheckStore";
import { evaluateBenefitCheck } from "../store/benefits/evaluate";
import { i18nKeys } from "../i18n/i18nKeys";

/**
 * TEIL C: placeholder. Renders the six assessments raw so the flow can be walked end to
 * end and the engine's output inspected. The designed view — status wording, hints,
 * disclaimer, translated reason codes — is part C's job.
 */
export const EligibilityResult: React.FC = () => {
	const { t } = useTranslation();
	const answers = useBenefitCheckStore((s) => s.answers);
	const today = new Date().toLocaleDateString("sv-SE");
	const result = evaluateBenefitCheck(answers, today);

	return (
		<StepLayout>
			<div className="w-full font-sans flex flex-col gap-6">
				<p
					className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
					role="note"
					data-testid="provisional-notice"
				>
					Vorläufige Ansicht. Die gestaltete Ergebnisseite folgt in Teil C.
				</p>

				<h1 className="text-xl font-bold text-brand-black">
					{t(i18nKeys.eligibility.title)}
				</h1>

				<ul className="flex flex-col gap-4 list-none p-0 m-0">
					{result.assessments.map((assessment) => (
						<li
							key={assessment.benefit}
							data-testid={`assessment-${assessment.benefit}`}
							className="rounded-xl border border-brand-border/40 p-4"
						>
							<p className="font-bold text-brand-black">
								{assessment.benefit}
							</p>
							<p className="text-base text-brand-grey">{assessment.status}</p>
							<p className="text-sm text-brand-grey">
								{assessment.reasons.join(", ")}
							</p>
						</li>
					))}
				</ul>

				{result.hints.length > 0 && (
					<ul
						className="flex flex-col gap-2 list-none p-0 m-0"
						data-testid="hints"
					>
						{result.hints.map((hint) => (
							<li key={hint} className="text-sm text-brand-grey">
								{hint}
							</li>
						))}
					</ul>
				)}
			</div>
		</StepLayout>
	);
};
```

- [ ] **Step 6: Die drei übrigen Store-Konsumenten umstellen**

In `src/views/AuthView.tsx`, `src/views/EligibilityStart.tsx` und
`src/store/useRootStore.ts` jeweils den Import von
`../store/useEligibilityStore` auf `../store/useBenefitCheckStore` und
`useEligibilityStore` auf `useBenefitCheckStore` ändern. In `useRootStore.ts` heißt das
Feld künftig `benefitCheckStore`. Sonst nichts — die genutzten Teile (`answers`,
`resetForm`, `token`) heißen unverändert.

- [ ] **Step 7: Alte Dateien löschen**

```bash
git rm src/schemas/eligibility.schema.ts \
       src/store/EligibilityEngine.ts src/store/EligibilityEngine.test.ts \
       src/store/useEligibilityStore.ts src/store/useEligibilityStore.test.ts \
       src/hooks/useEligibilityNavigation.ts \
       src/hooks/useEligibilityOutcome.ts
```

- [ ] **Step 8: Suite, Typecheck, Lint**

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe. Meldet er einen Verweis auf eine gelöschte Datei, ist ein
Konsument übersehen worden — `grep -rn "useEligibilityStore\|EligibilityEngine\|eligibility.schema" src/` findet ihn.

Run: `npm test`
Expected: `Tests  1 failed | <n> passed` mit genau einem roten Test,
`ApplicationOverview.test.tsx`. Die Tests der gelöschten Module verschwinden mit ihnen; die
neuen aus Tasks 2–8 kommen hinzu.

Run: `npm run lint`
Expected: dieselben vier Befunde wie in der Baseline (zwei Fehler, zwei Warnungen), alle in
`PersonalDataEdit.tsx` und `tests/fixtures/test-with-authenticated-user.ts`. Kein neuer.

- [ ] **Step 9: Im Browser gegenlesen**

Run: `npm run dev`, dann <http://localhost:5173> öffnen und den Check einmal komplett
durchklicken — als alleinerziehende Person mit einem Kind, damit Kinderliste,
Zahlenfelder und die Unterhaltsfragen alle vorkommen.

Erwartung: 12 Schirme, Fortschritt zählt korrekt, kein roher i18n-Schlüssel sichtbar, die
Übergangs-Ergebnisseite zeigt sechs Bewertungen und mindestens einen Hinweis. Auf Englisch
gegenprüfen, dann auf Deutsch zurückstellen.

- [ ] **Step 10: Commit**

```bash
git add -A src/
git commit -m "$(cat <<'EOF'
feat: wire the questionnaire to the profile sync and remove the old flow

The guest-data mapping moves to the flat answer model and gains what the new
questions make available: household composition to marital status and head count,
net household income, work capacity. Four answers stay deliberately unsent — the
profile schema has no column for them, and because it sets no extra="forbid" a
payload containing them would return HTTP 200 and silently discard the data.

The result view is a marked placeholder that renders the six assessments raw. It
exists so the flow can be walked end to end; the designed view is part C.

Deletes the graph engine, the old store, the old schema and the two hooks that
only served them.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Abschluss

Nach Task 9 läuft der neue Fragebogen von der Landing Page bis zu einer rohen
Ergebnisliste, und der alte Flow ist vollständig entfernt.

**Bewusst offen, für Teil C:**

- Die gestaltete Ergebnisansicht: Status-Formulierungen aus Fachspec §8, die drei Hinweise,
  der Disclaimer, Übersetzung der `ReasonCode`s. `nicht_zustaendig` soll laut Fachspec §8
  nicht wie eine Ablehnung wirken — im Zweifel dezent oder gar nicht anzeigen.
- `associated_persons` aus `children` bauen, mit Merge-Regel gegen das vollständige
  Ersetzen der Kollektion durch das Endpoint.
- Die vier Lücken, sobald das Backend nachzieht. Sie sind in
  `application.service.ts` mit `GAP:` markiert.
- `monthlyWarmRent` hat kein Zielfeld: `rent_total`, `heating_costs` und `hot_water_costs`
  existieren getrennt, und eine Warmmiete lässt sich nicht verlustfrei zurückzerlegen. Das
  ist eine fünfte Lücke, die erst in Teil B sichtbar geworden ist.

**Nicht mehr in Gebrauch:** beide Skip-Heuristiken der Fachspec §5.
`liegtImKinderzuschlagKorridor` fiel in Teil A weg, `deutetAufAnspruchHin` in Teil B.
