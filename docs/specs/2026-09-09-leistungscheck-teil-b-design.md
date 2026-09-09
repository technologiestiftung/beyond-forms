# Leistungscheck — Teil B: Fragebogen

**Datum:** 2026-09-09
**Status:** Entwurf, zur Abnahme
**Grundlage:** `leistungscheck-agent-spezifikation.md` (Fachspec), `docs/specs/2026-09-09-leistungscheck-teil-a-design.md` (Teil A)

---

## 1. Zweck und Abgrenzung

Teil A liefert die Entscheidungslogik. Teil B liefert den Weg, auf dem die Antworten
zusammenkommen: Fragenkatalog, Flow, Eingabekomponenten, Fortschritt, Copy.

### In Teil B enthalten

- Flachziehen des Antwortmodells aus Teil A (§2)
- Fragenkatalog als Konfiguration, 15 Fragen mit Skip-Bedingungen (§4)
- `useBenefitCheckStore` als Ersatz für `useEligibilityStore` (§5)
- Flow-Ansicht, Navigation, dynamischer Fortschritt (§6)
- Zwei neue Eingabekomponenten (§7)
- Copy für 15 Fragen in `de` und `en` (§8)
- Übergangslösung für Ergebnisansicht und Profil-Sync, damit die App lauffähig bleibt (§9)

### Nicht in Teil B

| Thema | Teil |
|---|---|
| Gestaltete Ergebnisansicht, sechs Status, Hinweise, Disclaimer | C |
| Profil-Übertragung, `associated_persons`-Merge | C |
| Rules Engine, Middleware, Migrationen | außerhalb |

---

## 2. Das Antwortmodell wird flach

### Befund

Teil A verschachtelt `household`, `employment` und `childSupport`. Innerhalb dieser Objekte
sind die Felder verpflichtend:

```ts
export const EmploymentSchema = z.object({
	isEmployed: z.boolean(),
	monthlyGrossIncome: z.number().min(0),
});
```

Da „Arbeitest Du?" und „Wie hoch ist das Brutto?" auf getrennten Schirmen liegen (§4), muss
der Zustand „erste Frage beantwortet, zweite noch nicht" darstellbar sein. Er ist es nicht:
`{ isEmployed: true }` fällt durch die Validierung. Für `childSupport` gilt dasselbe.

Die Verschachtelung stammt aus der Fachspec §3. Für eine Engine, die ein vollständiges
Objekt bewertet, ist sie richtig; für einen Fragebogen, der inkrementell füllt, nicht.

### Neues Modell

15 optionale Felder auf oberster Ebene:

| Feld | Typ |
|---|---|
| `householdComposition` | `HouseholdComposition` |
| `children` | `Array<{ dateOfBirth: string }>` |
| `dateOfBirth` | ISO-Datum |
| `livesInGermany` | `boolean` |
| `workCapacity` | `WorkCapacity` |
| `isEmployed` | `boolean` |
| `monthlyGrossIncome` | `number` |
| `monthlyNetHouseholdIncome` | `number` |
| `monthlyWarmRent` | `number` |
| `assetsBand` | `AssetsBand` |
| `receivesBenefitsAlready` | `boolean` |
| `citizenship` | `Citizenship` |
| `hasSecureResidenceStatus` | `boolean` |
| `childReceivesFullSupport` | `boolean` |
| `monthsWithoutChildSupport` | `number` |

`HouseholdSchema`, `EmploymentSchema` und `ChildSupportSchema` entfallen. `Household` als
Typ entfällt; die Ableitungsfunktionen nehmen künftig `householdComposition` und `children`
als getrennte Argumente.

**15 Fragen, 15 Felder, 1:1.** Jede Frage schreibt genau ein Feld, jedes Feld hat genau eine
Frage. Damit ist der Katalog gegen das Schema prüfbar, und der Store kann pro Feld über
`BenefitCheckAnswersSchema.shape[field]` validieren — genau wie `useEligibilityStore` heute.

### `livesInGermany` bleibt erhalten

In der Vorbesprechung war vorgesehen, das Feld zu streichen, weil keine Regel es liest. Beim
Nachverfolgen des heutigen Syncs zeigt sich: die alte Frage „Wohnst Du in Deutschland?"
befüllt `is_resident_in_germany` im Profil
([application.service.ts:24](../../services/wallet-frontend/src/services/application.service.ts#L24)).
Streichen wäre kein Aufräumen, sondern ein Rückschritt bei dem, was Teil C übertragen kann.

Das Feld heißt deshalb `livesInGermany`, nicht `livesInBerlin` wie in der Fachspec §3 — es
bildet die Rechtsvoraussetzung ab, die auch das Zielfeld meint. Die bestehende Copy wird
unverändert übernommen.

### Anpassung der Regeln

Das Flachziehen berührt nicht nur Feldpfade, sondern auch drei Wächter:

**Kinderzuschlag (§6.5).** Bisher `childrenUnder25(household, today).length === 0 →
NOT_APPLICABLE`. Neu dreistufig:

1. `householdComposition` ist `SINGLE` oder `COUPLE_NO_CHILDREN` → `NOT_APPLICABLE`
   (definitiv keine Kinder)
2. `householdComposition` impliziert Kinder, `children` aber noch `undefined` →
   `CHECK_ADVISED` / `INSUFFICIENT_DATA`
3. sonst wie bisher filtern

**Unterhaltsvorschuss (§6.6).** Analog: `composition !== SINGLE_PARENT` →
`NOT_APPLICABLE`; `children === undefined` → `INSUFFICIENT_DATA`; sonst filtern.

**Bedarfsrechnung.** `householdStandardNeeds` braucht Komposition und Kinder. Fehlt eines
davon, greift der bestehende `INSUFFICIENT_DATA`-Wächter in `assessMeans`; die Feldliste
dort wird entsprechend erweitert.

Eine neue Hilfsfunktion `compositionImpliesChildren(composition): boolean` bedient beide
Stellen und zugleich die Skip-Bedingung der Kinderfrage (§4) — eine Wahrheit, ein Ort.

**Wichtig:** Wird eine Frage übersprungen, wird **nichts** geschrieben. Es gibt keinen
Automatismus, der `children: []` setzt. Die Unterscheidung „definitiv keine Kinder"
(aus der Komposition) gegen „noch nicht beantwortet" (`undefined`) bleibt damit intakt.

---

## 3. Die Skip-Bedingung für die Staatsangehörigkeit entfällt

Die Fachspec §4 stellt F9 nur, wenn `deutetAufAnspruchHin(a)` — um die Frage nicht allen zu
stellen. Das ist nicht tragfähig: **jede** der sechs Regeln ruft `residenceRequirementMet`,
und ohne Antwort liefert das `undefined`, womit alle sechs Leistungen auf
`CHECK_ADVISED / INSUFFICIENT_DATA` landen. Wer die Frage nicht gestellt bekommt, bekommt
kein Ergebnis.

In der Fachspec selbst fällt das weniger auf, weil `aufenthaltsrechtErfuellt` bei fehlenden
Daten `false` liefert und alles auf `eher_nein` geht — auch nicht richtig, nur anders falsch.

**Die Staatsangehörigkeit wird immer gefragt.** `deutetAufAnspruchHin` entfällt vollständig,
wie schon `liegtImKinderzuschlagKorridor` in Teil A. Damit ist keine der beiden
Skip-Heuristiken der Fachspec §5 mehr in Gebrauch; beide standen auf Größen, die die
Spezifikation an anderer Stelle selbst als unbestimmbar oder tragend bezeichnet.

---

## 4. Fragenkatalog

`src/store/benefits/questionCatalogue.ts` — Konfiguration, kein verdrahteter Ablauf.

```ts
type QuestionInput = "choice" | "boolean" | "date" | "number" | "children";

interface BenefitQuestion {
	id: string;                    // Route-Segment
	field: keyof BenefitCheckAnswers;
	input: QuestionInput;
	options?: readonly string[];   // nur bei "choice"
	unit?: "EUR" | "MONTHS";       // nur bei "number"
	skipIf?: (a: PartialBenefitCheckAnswers, today: string) => boolean;
}
```

`"boolean"` ist kein eigener Baustein: die Frage wird mit `QuestionCard` und den Optionen
`YES` / `NO` gerendert, und der Flow wandelt in `true` / `false`. So bleiben es zwei neue
Komponenten (§7).

### Die 15 Fragen in Reihenfolge

| # | `id` | Feld | Input | wird übersprungen wenn |
|---|---|---|---|---|
| 1 | `household` | `householdComposition` | choice | — |
| 2 | `children` | `children` | children | `!compositionImpliesChildren(composition)` |
| 3 | `birthdate` | `dateOfBirth` | date | — |
| 4 | `germany` | `livesInGermany` | boolean | — |
| 5 | `work-capacity` | `workCapacity` | choice | `hasReachedRetirementAge(dateOfBirth, today)` |
| 6 | `employment` | `isEmployed` | boolean | — |
| 7 | `gross-income` | `monthlyGrossIncome` | number (EUR) | `isEmployed === false` |
| 8 | `net-income` | `monthlyNetHouseholdIncome` | number (EUR) | — |
| 9 | `warm-rent` | `monthlyWarmRent` | number (EUR) | — |
| 10 | `assets` | `assetsBand` | choice | — |
| 11 | `benefits` | `receivesBenefitsAlready` | boolean | — |
| 12 | `citizenship` | `citizenship` | choice | — |
| 13 | `residence-status` | `hasSecureResidenceStatus` | boolean | `citizenship === "DE_EU"` |
| 14 | `child-support` | `childReceivesFullSupport` | boolean | `!compositionImpliesChildren(composition)` |
| 15 | `support-duration` | `monthsWithoutChildSupport` | number (MONTHS) | `childReceivesFullSupport !== false` |

Neun Fragen kommen immer, sechs sind überspringbar. **Minimum 9 Schirme, Maximum 15.**

Die Fachspec zählt „höchstens 10", zählt dabei aber eine Doppelfrage als eine. Inhaltlich
ist es dieselbe Menge Fragen, nur auf mehr Schirme verteilt — eine Idee pro Schirm, weil die
Zielgruppe laut den Persona-Dokumenten (`demo/research/01_sabine.md`) ausdrücklich unter
kognitiver Last steht.

### Regel für `skipIf`

Eine Skip-Bedingung darf nur auf Felder zugreifen, die **vor** ihr in der Reihenfolge
erhoben werden. Ist das Feld noch `undefined`, muss sie `false` liefern (nicht
überspringen) — der Pfad wird ohnehin nach der ersten unbeantworteten Frage abgeschnitten
(§6), aber ein `undefined`-Zugriff darf nie versehentlich zu einem Skip führen.

---

## 5. Store

`src/store/useBenefitCheckStore.ts` ersetzt `useEligibilityStore.ts`. Struktur bleibt:

```
answers: PartialBenefitCheckAnswers
maxDepthReached: number
validationError: string | null
setAnswer(field, value)      // validiert über shape[field], setzt Fehler statt zu werfen
clearAnswer(field)
recordStepReached(step)
resetForm()
clearError()
```

Weiterhin `persist` mit `createZustandStorage("session")` und einer **erhöhten `version`**,
damit alte Sessions mit dem inkompatiblen Antwortobjekt nicht einlaufen. Der bestehende
Store steht auf `version: 8`; der neue beginnt bei `9`. Ohne diese Erhöhung würde ein
offener Tab mit altem Zustand in einen Validierungsfehler laufen.

Das abgeleitete `isEligible` entfällt. Es gibt kein einzelnes Ergebnis mehr; die
Ergebnisansicht ruft `evaluateBenefitCheck(answers, today)` aus Teil A.

---

## 6. Flow, Navigation, Fortschritt

Routing bleibt URL-getrieben (`/eligibility-check/:questionId`), damit Zurück-Button,
Deep-Link und der Fortschritt aus dem Pfadindex weiter funktionieren.

`getValidPath(answers, today)` wird deutlich einfacher als der heutige Graphenlauf: den
Katalog gegen die Skip-Bedingungen filtern, dann nach der ersten unbeantworteten Frage
abschneiden. Kein `next()` pro Knoten, keine `NodeId`-Union.

**Keine Früh-Ausstiege.** Der heutige Flow springt bei `nationality: NONE` sofort auf ein
Ergebnis. Das entfällt: es gibt kein einzelnes „nicht berechtigt" mehr, und selbst ein
ungesicherter Aufenthaltsstatus ist wertvoll, weil daraus der AsylbLG-Hinweis der
Fachspec §7 entsteht. Der Flow läuft immer bis zum Ende.

### Fortschritt

„Frage 3 von 9". Der Nenner ist die Länge des gefilterten Katalogs bei den aktuellen
Antworten und ändert sich daher im Verlauf. Meist sinkt er (angenehm), er kann aber steigen
— etwa wenn eine Haushaltsform mit Kindern die Unterhaltsfragen aktiviert.

Der Balken selbst läuft nie zurück: `ProgressBar` nutzt bereits
`Math.max(current, maxDepthReached)`. Diese Komponente bleibt unverändert, nur ihr `total`
kommt jetzt aus dem Pfad statt aus einer Konstante. `ELIGIBILITY_TOTAL_STEPS` entfällt.

---

## 7. Komponenten

### Weiterverwendet, unverändert

`QuestionCard` deckt alle vier `choice`- und alle fünf `boolean`-Fragen ab — sechs davon
kommen immer, drei sind überspringbar, also **sechs bis neun Schirme aus einer bestehenden
Komponente**. Dazu `DateOfBirthCard` (Geburtsdatum), `ProgressBar`, `StepLayout`,
`PrimaryButton`.

### `NumberCard` (neu)

Ein Zahlenfeld mit Einheit, für Brutto, Netto, Warmmiete und Monate. Übernimmt die
Kopfstruktur von `QuestionCard` (`category` / `title` / `tip` / Info-Box) und dessen
Fokus-Verhalten, damit die Schirme sich nicht unterscheiden.

- `type="text"` mit `inputMode="decimal"` statt `type="number"` — Letzteres erzeugt auf
  Mobilgeräten Spinner-Pfeile und erlaubt Scroll-Änderungen des Werts
- Eingabe wird auf Ziffern, Komma und Punkt begrenzt; Komma wird beim Übernehmen zu Punkt
- Leeres Feld ist kein `0`, sondern „unbeantwortet"
- „Weiter" bleibt inaktiv, solange kein gültiger Wert vorliegt — dasselbe Verhalten wie
  `QuestionCard` ohne Auswahl

### `ChildrenCard` (neu)

Die dynamische Liste — der aufwendigste Baustein.

- Pro Kind eine Datumseingabe im Muster von `DateOfBirthCard`: ein natives
  `<input type="date">` mit `min="1900-01-01"`, `max` auf heute und Gültigkeitsprüfung über
  `input.validity.valid`. Nicht getrennte Tag/Monat/Jahr-Felder — die Skizze in der
  Vorbesprechung zeigte das so, das Repo macht es anders, und das bestehende Muster gewinnt
- „+ Kind hinzufügen" fügt eine leere Zeile an, „Entfernen" pro Zeile
- Startzustand: eine leere Zeile, damit ohne zusätzlichen Klick begonnen werden kann
- „Weiter" bleibt inaktiv, solange nicht **jede** Zeile ein gültiges Datum enthält
- Leere Zeilen werden beim Übernehmen verworfen, damit eine versehentlich hinzugefügte
  Zeile nicht blockiert
- Jede Zeile trägt ein sichtbares Label („Kind 1", „Kind 2"), und Entfernen-Knöpfe haben ein
  Aria-Label mit der Nummer — ohne das ist die Liste mit Screenreader nicht bedienbar

---

## 8. Copy

Struktur und Tonlage werden unverändert übernommen: pro Frage `category` (Themen-Überschrift),
`title` (die Frage), `tip` (Info-Box, die erklärt *warum* gefragt wird), plus Optionslabels
als vollständige Ich-Sätze („Ich habe die deutsche Staatsangehörigkeit.").

Umfang: 15 Fragen × 3 Textbausteine plus Optionslabels, in `de` und `en`, unter
`questions.*` in `eligibility.json`. Wiederverwendbar sind die bestehenden Blöcke für
`birthdate` und `germany`; die übrigen 13 sind neu.

`hasAssetsAboveThreshold`, `income`, `nationality` und `pension` werden aus den
Locale-Dateien entfernt — ihre Fragen existieren nicht mehr.

**Die Copy ist der Teil, bei dem Nachschärfen durch einen Menschen am wahrscheinlichsten
ist.** Sie wird als Vorschlag geliefert, nicht als fertige Fassung.

---

## 9. Übergangslösung für Ergebnis und Sync

Vier Dateien hängen am alten Antwortmodell und gehören inhaltlich zu Teil C. Sie werden in
Teil B **minimal** angepasst, damit die App lauffähig und der Flow von Anfang bis Ende
testbar bleibt — nicht ausgestaltet.

| Datei | Übergangslösung |
|---|---|
| `EligibilityResult.tsx` | Rendert die sechs Bewertungen aus `evaluateBenefitCheck` als schlichte Liste: Leistungsname, Status, Begründungscodes im Rohtext. Ungestaltet, mit Kommentar `// TEIL C:` |
| `useEligibilityOutcome.ts` | Entfällt — es bildete `ResultProfile` auf drei i18n-Keys ab, die es nicht mehr gibt |
| `application.service.ts` | `mapEligibilityToProfilePayload` wird auf das flache Modell umgestellt und mappt die Felder, die schon heute gemappt werden. Die vier Lücken aus Teil A §9 bleiben mit `// GAP:` unbelegt |
| `externalLinks.ts` | Bleibt; der Sozialamt-Link wird in Teil C wieder gebraucht |

Damit die Übergangsansicht nicht versehentlich produktiv wirkt, trägt sie einen sichtbaren
Hinweis, dass die Darstellung vorläufig ist. Das ist keine Verifikationsschranke wie in
Teil A verworfen, sondern eine Baustellen-Markierung für die eigene Mannschaft.

---

## 10. Was entfernt wird

| Datei | Grund |
|---|---|
| `src/schemas/eligibility.schema.ts` | ersetzt durch `benefitCheck.schema.ts` |
| `src/store/EligibilityEngine.ts` + Test | Graphenmodell mit einem Ergebnis, ersetzt durch Katalog + sechs Bewertungen |
| `src/store/useEligibilityStore.ts` + Test | ersetzt durch `useBenefitCheckStore.ts` |
| `src/hooks/useEligibilityNavigation.ts` | ersetzt durch die Katalog-Variante |
| `src/hooks/useEligibilityOutcome.ts` | siehe §9 |

`EligibilityFlow.tsx`, `ProgressBar.tsx` und `routeConfig.tsx` werden angepasst, nicht
ersetzt. Die Routen-Konstanten in `routes.ts` bleiben unverändert — die Frage-IDs sind
Parameterwerte, keine eigenen Routen.

---

## 11. Tests

`vitest`, `@testing-library/react`, wie im Repo. `today` überall injiziert.

| Bereich | Fälle |
|---|---|
| Flachziehen | Die 88 Tests aus Teil A müssen nach der Umstellung unverändert grün sein; die fünf Abnahmefälle der Fachspec §9 sind der Nachweis |
| Katalog | Jedes Feld des Schemas hat genau eine Frage und umgekehrt (1:1 maschinell geprüft); jede `skipIf` greift nur auf früher erhobene Felder zu |
| Pfad | Pfad mit leeren Antworten hat Länge 1; Skip entfernt genau die erwartete Frage; Pfad bricht nach der ersten unbeantworteten Frage ab |
| Fortschritt | Nenner sinkt bei kinderloser Haushaltsform; Balken läuft bei Rückwärtsnavigation nicht zurück |
| Store | Feldweise Validierung setzt `validationError` statt zu werfen; `clearAnswer` entfernt genau ein Feld; `version`-Sprung verwirft alten Zustand |
| `NumberCard` | Komma wird zu Punkt; leeres Feld blockiert „Weiter"; Buchstaben werden abgewiesen |
| `ChildrenCard` | Hinzufügen und Entfernen; unvollständige Zeile blockiert „Weiter"; leere Zeile wird verworfen; Aria-Labels tragen die Kindnummer |
| Flow | Ein vollständiger Durchlauf für Fachspec-Fall C (alleinerziehend, ein Kind) erreicht die Ergebnisansicht mit den erwarteten sechs Status |

Erwartung: die Suite bleibt bei genau einem roten Test, dem vorbestehenden
`ApplicationOverview.test.tsx`.

---

## 12. Entscheidungen und Abweichungen

| # | Festlegung | Art |
|---|---|---|
| 1 | Antwortmodell flach statt verschachtelt | **Korrektur an Teil A**, erzwungen durch den schrittweisen Flow |
| 2 | `livesInGermany` bleibt erhalten | Korrektur der Vorbesprechung; das Feld befüllt `is_resident_in_germany` |
| 3 | Doppelfragen auf getrennte Schirme; nur zwei neue Komponenten | Vorgabe Auftraggeber |
| 4 | Fortschritt mit dynamischem Nenner, Balken monoton | Vorgabe Auftraggeber |
| 5 | Staatsangehörigkeit immer fragen; `deutetAufAnspruchHin` entfällt | **Abweichung Fachspec §4/§5** |
| 6 | Keine Früh-Ausstiege mehr | Folge des Sechs-Leistungs-Modells |
| 7 | Übersprungene Fragen schreiben nichts; `undefined` ≠ „keine" | Ergänzung |
| 8 | Store-`version` auf 9 | Ergänzung, verhindert Einlaufen alter Sessions |
| 9 | `type="text"` + `inputMode="decimal"` statt `type="number"` | Ergänzung |

Punkt 1 ist die wichtigste: er berührt Code, der in Teil A bereits abgenommen und getestet
ist. Der Umbau ist mechanisch, und die Abnahmefälle der Fachspec §9 sind der Nachweis, dass
die Logik dabei unverändert bleibt.

---

## 13. Offen

- Die Copy für 13 neue Fragen ist ein Vorschlag und braucht menschliche Prüfung, bevor sie
  Nutzer erreicht.
- Der Nenner des Fortschritts kann im Verlauf steigen. Bewusst in Kauf genommen; falls es in
  Tests mit Nutzenden irritiert, wäre ein fester Nenner die Ausweichlösung.
- Die Verifikationsliste aus Teil A §11 bleibt unverändert offen.
