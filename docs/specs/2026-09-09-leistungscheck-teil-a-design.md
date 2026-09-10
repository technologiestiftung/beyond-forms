# Leistungscheck — Teil A: Antwortmodell und Entscheidungslogik

**Datum:** 2026-09-09
**Status:** Entwurf, zur Abnahme
**Grundlage:** `leistungscheck-agent-spezifikation.md` (Fachspezifikation, im Folgenden „die Fachspec")

---

## 1. Zweck und Abgrenzung

Der bestehende Eligibility-Check prüft ausschließlich Grundsicherung und liefert ein einzelnes
Ergebnis (`ELIGIBLE` / `NOT_ELIGIBLE` / `SOZIALAMT`). Er wird durch eine Ersteinschätzung
ersetzt, die **sechs Sozialleistungen unabhängig voneinander** bewertet.

Teil A liefert davon die **reine Logik**: Antwortmodell, Rechtskonstanten, Ableitungsfunktionen,
sechs Entscheidungsfunktionen, Aggregation. Alles sind pure Funktionen ohne React, ohne
Netzwerk, ohne Storage.

### In Teil A enthalten

- Zod-Antwortmodell (ersetzt `EligibilityCheckSchema`)
- Konfigurationsmodul mit allen rechtlich tragenden Konstanten
- Ableitungsfunktionen (Fachspec §5)
- Sechs Entscheidungsfunktionen (Fachspec §6)
- Aggregation inkl. Hinweise und Disclaimer (Fachspec §7)
- Unit-Tests, darunter die fünf Testfälle der Fachspec §9

### Nicht in Teil A

| Thema | Teil |
|---|---|
| Fragenkatalog, Skip-Logik, Fortschritt, Eingabekomponenten, i18n | B |
| Ergebnisansicht, Profil-Übertragung, `associated_persons`-Merge | C |
| Rules Engine, Middleware, Migrationen, Formular-Mappings | außerhalb |

Teil A ist damit vollständig lokal baubar und gegen die Testfälle verifizierbar, bevor UI-Arbeit
hineinfließt.

### Architekturentscheidung

Die Entscheidungslogik läuft **im Frontend**, wie der heutige `EligibilityEngine`. Die
Datenbank spielt für das Ergebnis keine Rolle: der Fragebogen erhebt alle Datenpunkte, die
Engine rechnet über das vollständige Antwortobjekt, und erst danach wird ein Teil davon ins
Profil übertragen (Teil C). Die Einschätzung ist deshalb inhaltlich vollständig, auch solange
vier Felder nicht persistiert werden können (§9).

Alle Rechtskonstanten liegen isoliert in **einem** Modul, damit die Logik später in die
Rules Engine (`POST /wizard/evaluate`, JSONC-Regelformat) wandern kann, ohne neu geschrieben
zu werden.

---

## 2. Namenskonvention

Die Fachspec ist deutsch, der Frontend-Code durchgehend englisch — Deutsch steckt dort
ausschließlich in i18n-Strings. Teil A verwendet **englische Identifier**. Grund: das
Antwortobjekt wird in Teil C über `toSnakeCase` auf Backend-Felder gemappt; ein deutsches
Feld würde dort als `vermoegen_band` in einem ansonsten englischen Schema landen.

| Fachspec | Teil A |
|---|---|
| `wohnsitzBerlin` | `livesInBerlin` |
| `geburtsdatum` | `dateOfBirth` |
| `erwerbsfaehig` | `workCapacity` |
| `haushalt.form` | `household.composition` |
| `haushalt.kinder[]` | `household.children[]` |
| `erwerbstaetigkeit` | `employment` |
| `nettoGesamteinkommenMonat` | `monthlyNetHouseholdIncome` |
| `warmmieteMonat` | `monthlyWarmRent` |
| `vermoegenBand` | `assetsBand` |
| `laufenderBezug` | `receivesBenefitsAlready` |
| `staatsangehoerigkeit` | `citizenship` |
| `aufenthaltsstatusGesichert` | `hasSecureResidenceStatus` |
| `unterhalt` | `childSupport` |
| `wahrscheinlich_ja` / `moeglich_pruefen` / `eher_nein` / `nicht_zustaendig` | `LIKELY_YES` / `CHECK_ADVISED` / `LIKELY_NO` / `NOT_APPLICABLE` |

---

## 3. Dateien

Tests liegen neben der Quelle (`*.test.ts`), wie im Repo üblich.

```
src/schemas/benefitCheck.schema.ts    Antwortmodell, Enums, Ergebnistypen
src/config/benefitRules.config.ts     Rechtskonstanten (siehe §5)
src/store/benefits/derive.ts          Ableitungsfunktionen (Fachspec §5)
src/store/benefits/rules.ts           sechs Entscheidungsfunktionen (Fachspec §6)
src/store/benefits/evaluate.ts        Aggregation (Fachspec §7)
src/store/benefits/*.test.ts
```

`src/store/benefits/` folgt dem bestehenden Präzedenzfall: der heutige `EligibilityEngine.ts`
liegt ebenfalls unter `src/store/`, obwohl er kein Zustand-Store ist. Ein eigenes
`src/domain/` wäre sauberer, würde aber ein neues Top-Level-Verzeichnis einführen.

### Was ersetzt wird

| Datei | Vorgehen | Wann |
|---|---|---|
| `src/schemas/eligibility.schema.ts` | ersetzt durch `benefitCheck.schema.ts` | Teil B |
| `src/store/EligibilityEngine.ts` | entfällt | Teil B |
| `src/store/EligibilityEngine.test.ts` | entfällt | Teil B |

**Teil A löscht keine dieser Dateien.** Sie werden nur hinzugefügt-daneben; die Löschung
passiert in Teil B, wenn der Fragebogen umgestellt ist.

`EligibilityEngine` modelliert einen linearen Baum aus `NodeId`-Knoten mit genau einem
Ergebnis (`getValidPath`, `getOutcomeProfile`). Das neue Modell ist ein flacher
Fragenkatalog plus sechs unabhängige Bewertungen — strukturell etwas anderes, deshalb Ersatz
statt Umbau.

Die Dateien bleiben bis Teil B/C im Baum, weil `useEligibilityStore`, `EligibilityFlow`,
`EligibilityResult` und `application.service` noch daran hängen. Teil A fügt nur hinzu und
bricht nichts.

---

## 4. Antwortmodell

`src/schemas/benefitCheck.schema.ts`, Zod, alle Felder optional (`Partial`), weil der
Fragebogen inkrementell füllt. Die Entscheidungsfunktionen müssen mit unvollständigen
Antworten umgehen (§7).

```ts
WorkCapacity        = "FULL" | "PERMANENTLY_REDUCED" | "TEMPORARILY_REDUCED"
HouseholdComposition= "SINGLE" | "SINGLE_PARENT" | "COUPLE_NO_CHILDREN" | "COUPLE_WITH_CHILDREN"
AssetsBand          = "UNDER_5000" | "FROM_5000_TO_15000" | "FROM_15000_TO_25000" | "OVER_25000"
Citizenship         = "DE_EU" | "NON_EU"

BenefitCheckAnswers = {
  livesInBerlin?:              boolean
  dateOfBirth?:                string            // ISO, Validierung wie heute
  workCapacity?:               WorkCapacity
  household?: {
    composition:               HouseholdComposition
    children:                  Array<{ dateOfBirth: string }>
  }
  employment?: {
    isEmployed:                boolean
    monthlyGrossIncome:        number            // 0 wenn nicht erwerbstätig
  }
  monthlyNetHouseholdIncome?:  number
  monthlyWarmRent?:            number
  assetsBand?:                 AssetsBand
  receivesBenefitsAlready?:    boolean
  citizenship?:                Citizenship
  hasSecureResidenceStatus?:   boolean           // nur bei NON_EU gesetzt
  childSupport?: {
    receivesFullSupport:       boolean
    monthsWithoutSupport:      number
  }
}
```

### Abweichung: Kinder werden mit Geburtsdatum erhoben, nicht mit Alter

Die Fachspec §3 erhebt `kinder[].alterJahre`. Teil A erhebt stattdessen `dateOfBirth`.

Begründung: Kinderzuschlag und Unterhaltsvorschuss haben harte Altersgrenzen (18, 25), an
denen ein Geburtstag den Ausgang kippt — ein gespeichertes Alter veraltet still. Wichtiger:
`associated_persons` in der Datenbank hat ein `date_of_birth`-Feld und **kein** Altersfeld.
Erheben wir nur das Alter, können Kinderzeilen in Teil C nicht sinnvoll übertragen werden.
Das Alter wird in der Engine aus dem Datum abgeleitet.

Kosten: eine Datumseingabe pro Kind statt einer Zahl. Die App hat mit `DateOfBirthCard`
bereits eine Komponente dafür.

### Ergebnistypen

```ts
BenefitId = "SGB_II_BASIC_INCOME"                  // Grundsicherungsgeld (SGB II)
          | "SGB_XII_OLD_AGE_REDUCED_CAPACITY"     // Grundsicherung im Alter und bei EM
          | "SGB_XII_SUBSISTENCE_AID"              // Hilfe zum Lebensunterhalt
          | "HOUSING_BENEFIT"                      // Wohngeld
          | "CHILD_SUPPLEMENT"                     // Kinderzuschlag
          | "ADVANCE_MAINTENANCE"                  // Unterhaltsvorschuss

BenefitStatus = "LIKELY_YES" | "CHECK_ADVISED" | "LIKELY_NO" | "NOT_APPLICABLE"

BenefitAssessment = { benefit: BenefitId, status: BenefitStatus, reasons: ReasonCode[] }

BenefitCheckResult = {
  assessments:   BenefitAssessment[]     // immer alle sechs, in fester Reihenfolge
  hints:         HintCode[]
}
```

Die Rechtsgrundlage steckt absichtlich in der `BenefitId`: die drei SGB-Leistungen sind unter
ihren deutschen Namen leicht zu verwechseln, und die IDs sind stabiler als Produktnamen
(„Bürgergeld" → „Grundsicherungsgeld" zum 1.7.2026).

### Begründungen sind Codes, keine Sätze

Die Fachspec §6 liefert `begruendung` als deutsche Klartextsätze. Teil A gibt stattdessen
`ReasonCode`-Enums zurück (z. B. `INCOME_BELOW_NEEDS`, `ASSETS_SPAN_ALLOWANCE`,
`RETIREMENT_AGE_REACHED`). Grund: die Logik darf keine Anzeigetexte enthalten — die App ist
zweisprachig, und Teil C übersetzt die Codes über i18n. Die Zuordnung Code → Satz ist Teil C.

---

## 5. Konfigurationsmodul

`src/config/benefitRules.config.ts` enthält **jeden** Wert, den die Fachspec §5/§6 als `TODO`
oder als Heuristik markiert. Kein Rechtswert steht irgendwo sonst im Code.

```ts
RETIREMENT_AGE_BY_BIRTH_YEAR   // §235 SGB VI, gestaffelt
STANDARD_NEEDS_BY_LEVEL        // Regelbedarfsstufen 1–6, §20/§28 SGB II bzw. SGB XII
ASSET_ALLOWANCE_BY_AGE         // altersgestaffelt ab 1.7.2026
KIZ_MIN_GROSS_INCOME           // { single, couple }
RENT_BURDEN_THRESHOLD          // Mietbelastungsquote Wohngeld
```

Jede Konstante trägt im Kommentar ihre Quelle und den Verifikationsstand. Werte aus der
Fachspec-Recherche werden übernommen und als unverifiziert markiert; nichts wird von mir
zusätzlich erfunden.

### Verifikationsstand: Kommentar, kein Laufzeitmechanismus

Der Platzhalter-Status wird **nur im Code dokumentiert**, nicht zur Laufzeit propagiert. Es
gibt kein `RULES_CONFIG_STATUS`, kein Feld im Ergebnis und kein Warnbanner in der
Ergebnisansicht — bewusste Entscheidung des Auftraggebers.

Konkret: `benefitRules.config.ts` bekommt einen Datei-Kopfkommentar, der auf die offene
Checkliste der Fachspec §11 verweist, und jede einzelne Konstante einen Kommentar mit Quelle
und Verifikationsstand. Wer die Werte anfasst, liest den Hinweis; ein Konsument zur Laufzeit
existiert nicht und würde ohne Verwendung nur toter Code sein.

### Regelbedarfsstufe aus dem Haushalt

`STANDARD_NEEDS_BY_LEVEL` ist nach Stufen 1–6 indiziert; die Fachspec ruft `regelbedarf(haushalt)`
ohne die Zuordnung zu definieren. Teil A legt sie explizit fest:

| Haushalt | Stufe | Ansatz |
|---|---|---|
| `SINGLE`, `SINGLE_PARENT` | 1 | Antragsteller |
| `COUPLE_*` | 2 | je Partner, zweimal angesetzt |
| Kind 0–5 | 6 | je Kind |
| Kind 6–13 | 5 | je Kind |
| Kind 14–17 | 4 | je Kind |
| Kind ab 18 im Haushalt | 3 | je Kind |

Der Haushaltsbedarf ist die Summe über alle Mitglieder. Diese Zuordnung ist eine
**Festlegung dieses Dokuments** und gehört auf die Verifikationsliste.

---

## 6. Ableitungsfunktionen

`src/store/benefits/derive.ts`, alle pur.

```
ageInYears(dateOfBirth, today)                → number
hasReachedRetirementAge(dateOfBirth, today)   → boolean
assetAllowance(ageYears)                      → number
householdStandardNeeds(household)             → number     // §5 oben
totalNeeds(household, monthlyWarmRent)        → number     // Regelbedarf + Warmmiete
residenceRequirementMet(answers)              → boolean
minorChildren(household) / childrenUnder25(household)
assetsVsAllowance(band, allowance)            → "BELOW" | "SPANS" | "ABOVE"
```

`today` wird überall **injiziert**, nie aus `new Date()` innerhalb der Logik gelesen. Sonst
sind Altersgrenzen nicht testbar und die Testfälle brechen mit fortschreitendem Datum.

### Verbesserung gegenüber der Fachspec: dreiwertige Vermögensprüfung

Die Fachspec §5 definiert `vermoegenUnterFreibetrag(band, freibetrag) -> boolean` über die
**Untergrenze** des Bands und erklärt im Kommentar, dass ein Band, das die Freibetragsgrenze
überspannt, ein unsicheres Ergebnis bedeutet — was ein Boolean nicht ausdrücken kann. In §6.1
wird das dann über zwei aufeinanderfolgende `if`-Zweige nachgebaut.

Teil A macht die drei Fälle explizit:

| Band vs. Freibetrag | Ergebnis |
|---|---|
| Obergrenze ≤ Freibetrag | `BELOW` |
| Untergrenze ≥ Freibetrag | `ABOVE` |
| sonst | `SPANS` |

Bandgrenzen: `UNDER_5000` = [0, 5000), `FROM_5000_TO_15000` = [5000, 15000),
`FROM_15000_TO_25000` = [15000, 25000), `OVER_25000` = [25000, ∞).

Damit fällt Testfall E (38 Jahre → Freibetrag 10.000, Band 5.000–15.000 → `SPANS` →
`CHECK_ADVISED`) direkt aus der Funktion heraus, statt aus der Reihenfolge zweier
`if`-Zweige. Fachlich identisch, nur ohne die implizite Kopplung.

---

## 7. Entscheidungsfunktionen

`src/store/benefits/rules.ts` — sechs Funktionen
`(answers, today) => BenefitAssessment`, die Logik jeweils aus Fachspec §6.1–6.6.
Sie sind voneinander unabhängig; eine Person kann mehrere Leistungen treffen.

### Umgang mit unvollständigen Antworten

Die Fachspec setzt ein vollständiges Antwortobjekt voraus. Da der Fragebogen inkrementell
füllt und Teil B eine Vorschau anzeigen können soll, gilt in Teil A: **fehlt ein Feld, das
eine Funktion zwingend braucht, liefert sie `CHECK_ADVISED` mit
`reasons: ["INSUFFICIENT_DATA"]`** — nie `LIKELY_NO`. Eine fehlende Antwort darf nie wie eine
Ablehnung aussehen.

Diese Regel **überschreibt** einzelne Zweige der Fachspec, die Abwesenheit von Daten wie eine
inhaltliche Antwort behandeln. Betroffen ist §6.6:

```
if not a.unterhalt or a.unterhalt.erhaeltVollenUnterhalt:  -> eher_nein
```

Hier bedeutet „`unterhalt` fehlt" nicht „Kind erhält Unterhalt". In Teil A wird der Zweig
aufgeteilt: `childSupport` fehlt → `CHECK_ADVISED` / `INSUFFICIENT_DATA`;
`receivesFullSupport === true` → `LIKELY_NO`.

Abzugrenzen davon sind `NOT_APPLICABLE`-Zweige, die auf einer *vorhandenen* strukturellen
Antwort beruhen (z. B. Haushaltsform ist nicht alleinerziehend, Regelaltersgrenze erreicht).
Die bleiben `NOT_APPLICABLE`. Fehlt die strukturelle Antwort selbst, gilt wieder
`INSUFFICIENT_DATA`.

### Reihenfolge-Invariante

`workCapacity` wird nicht erhoben, wenn die Regelaltersgrenze erreicht ist (Fachspec §4,
`skipIf` bei F3). §6.1 und §6.3 lesen das Feld erst *nach* einem Zweig, der bei erreichter
Regelaltersgrenze zurückkehrt — das Feld ist dort also gesetzt. Diese Invariante ist im
Code zu kommentieren, weil sie bei einer Änderung der Fragenreihenfolge still bricht.

**Nachtrag 2026-09-10:** Teil B §4a hat einen zweiten Skip ergänzt — die Frage entfällt
auch bei einem Bruttoeinkommen über der Schwelle. Für die Regeln ändert das nichts, weil
die Navigation dort `workCapacity: FULL` nachträgt; das Feld ist also weiterhin gesetzt,
sobald die Frage hinter einem der Beteiligten liegt. Beim Regelaltersgrenzen-Skip wird
weiterhin nichts nachgetragen, und genau darauf stützt sich die Invariante oben.

### Korrektur eines Fehlers in Fachspec §6.5

§6.5 prüft:

```
hatKinder = kinder.length > 0 and alle(kinder, k -> k.alterJahre < 25)
```

`alle` ist falsch. Ein Haushalt mit einem 26-jährigen und einem 5-jährigen Kind fällt damit
auf `nicht_zustaendig` für Kinderzuschlag, obwohl das 5-jährige Kind anspruchsberechtigt ist.
Teil A verwendet `mindestens ein Kind unter 25`:

```
hasEligibleChildren = childrenUnder25(household).length > 0
```

### Abweichung: F10 wird nicht über den Kinderzuschlag-Korridor gesprungen

Die `skipIf`-Bedingung von F10 (Fachspec §4) ruft `liegtImKinderzuschlagKorridor`, das laut
§5 die Höchsteinkommensgrenze näherungsweise auswertet — eine Größe, die §6.5 ausdrücklich
als nicht berechenbar bezeichnet und an die amtliche Formel verweist. Eine Skip-Bedingung
darf nicht auf einem Wert stehen, den die Spezifikation selbst für unbestimmbar erklärt.

Teil A stellt F10, sobald Kinder im Haushalt sind. Kosten: im Randfall eine Frage mehr.
Gewinn: keine Skip-Logik auf einer Scheingröße. `liegtImKinderzuschlagKorridor` entfällt
damit vollständig.

Die Festlegung betrifft die Skip-Logik, also formal Teil B — sie steht hier, weil sie eine
Hilfsfunktion aus §5 streicht.

### Aggregation

`src/store/benefits/evaluate.ts` ruft alle sechs Funktionen in fester Reihenfolge auf und
ergänzt die Hinweise aus Fachspec §7:

- `EDUCATION_PARTICIPATION_PACKAGE` — Kinder im Haushalt und mindestens eine der fünf
  Basisleistungen auf `LIKELY_YES` oder `CHECK_ADVISED`
- `CHILD_BENEFIT_PREREQUISITE` — Kinder im Haushalt
- `ASYLUM_BENEFITS_REFERRAL` — `citizenship === "NON_EU"` und
  `hasSecureResidenceStatus === false`

Der Disclaimer der Fachspec §7 ist **kein** Feld des Ergebnisses, sondern ein i18n-Key, den
die Ergebnisansicht unabhängig vom Rechenergebnis immer rendert. Er darf nicht davon
abhängen, dass die Engine ihn mitliefert.

---

## 8. Tests

`vitest`, wie im Repo. Reine Funktionen, keine Mocks, `today` fest injiziert.

**Fachspec §9, Fälle A–E** werden 1:1 als Tests übernommen und sind die Abnahmebedingung
für Teil A.

Zusätzlich:

| Bereich | Fall |
|---|---|
| Vermögen | je ein Test für `BELOW`, `SPANS`, `ABOVE` an der Bandgrenze |
| Vollständigkeit | leeres Antwortobjekt → alle sechs `CHECK_ADVISED` mit `INSUFFICIENT_DATA`, kein `LIKELY_NO` |
| §6.5-Korrektur | Haushalt mit Kind 26 **und** Kind 5 → Kinderzuschlag nicht `NOT_APPLICABLE` |
| Mehrfachtreffer | Alleinerziehend im Wohngeld-Korridor → Unterhaltsvorschuss, Kinderzuschlag und Wohngeld gleichzeitig ≠ `NOT_APPLICABLE` |
| Altersgrenzen | Kind am 18. und am 25. Geburtstag; Regelaltersgrenze am Stichtag |
| Nachrang | `receivesBenefitsAlready === true` → Wohngeld `NOT_APPLICABLE` |
| Aggregation | Hinweise erscheinen genau unter den Bedingungen aus §7 |

Erwartung: Teil A ist grün, ohne bestehende Tests zu verändern. Der vorbestehende Fehlschlag
in `ApplicationOverview.test.tsx` bleibt unberührt.

---

## 9. Bekannte Lücken

Vier Datenpunkte haben **kein** Feld im Profil-Schema und in der Datenbank. Sie werden
erhoben und in der Einschätzung verwendet, aber in Teil C **nicht** an `POST /profile`
gesendet:

| Datenpunkt | Lage |
|---|---|
| `employment.monthlyGrossIncome` | kein Brutto-Feld; `monthly_income` ist laut Schema netto |
| `assetsBand` | nur `has_assets` (bool), `assets_description`, `assets_types` |
| `childSupport.receivesFullSupport` | vorhandene Felder meinen Zahlpflicht, nicht Empfang |
| `childSupport.monthsWithoutSupport` | kein Feld |

Dazu drei weitere Befunde:

1. **`is_currently_employed` ist nicht schreibbar.** Die Spalte existiert und der LLM darf
   sie über `UserInformationUpdateSchema` setzen, aber `UserProfileValidationSchema` — das
   Schema von `POST /profile` — kennt sie nicht. Insgesamt betrifft die Divergenz 13 Spalten.
2. **Unbekannte Felder werden still verworfen.** `UserProfileValidationSchema` setzt kein
   `extra="forbid"`, also gilt Pydantics Default `extra="ignore"`: ein Payload mit den vier
   Feldern liefert HTTP 200 und verliert die Daten. Genau so verschwindet heute die
   `income`-Antwort des alten Checks. Deshalb werden die vier Felder bewusst weggelassen und
   an der Mapping-Funktion mit `// GAP:` markiert, statt sie hoffnungsvoll mitzusenden.
3. **Das Einschätzungsergebnis wird nirgends persistiert.** Es gibt kein Feld dafür; heute
   lebt `isEligible` nur im Store, und der Store liegt in `sessionStorage` — mit dem Tab ist
   alles weg. Bei sechs Ergebnissen statt einem wiegt das schwerer.

Keiner dieser Punkte blockiert Teil A oder B. Für Teil C ist der Unterschied ein Mapping mit
8 statt 12 Feldern.

### Vorschlag an das Backend

| Spalte auf `users` | Typ |
|---|---|
| `monthly_gross_income` | `NUMERIC` |
| `assets_band` | `TEXT` / Enum — **nicht** numerisch, eine aus dem Band abgeleitete Zahl wäre erfundene Präzision |
| `child_receives_full_support` | `BOOLEAN` |
| `months_without_child_support` | `INTEGER` |

Offene Frage dazu: Unterhalt gehört fachlich **pro Kind** an `associated_persons` — die
Tabelle führt bereits Einkommensfelder pro Person. Die Fachspec modelliert ihn einmal pro
Haushalt, was für v1 genügt; sobald mehrere Kinder mit unterschiedlicher Unterhaltssituation
abgebildet werden, ist `users` der falsche Ort.

Unabhängig davon: die 13 Spalten in `UserProfileValidationSchema` ergänzen. Das ist billig
(eine Zeile pro Feld, keine Migration) und behebt die eigentliche Ursache.

---

## 10. Entscheidungen und Abweichungen — Übersicht

| # | Festlegung | Art |
|---|---|---|
| 1 | Logik im Frontend, Rechtskonstanten in einem portierbaren Modul | Architektur |
| 2 | Englische Identifier, Übersetzungstabelle in §2 | Konvention |
| 3 | Kinder mit Geburtsdatum statt Alter | Abweichung Fachspec §3 |
| 4 | `assetsVsAllowance` dreiwertig statt Boolean | Verbesserung Fachspec §5 |
| 5 | `hasEligibleChildren` mit „mindestens ein Kind < 25" | **Fehlerkorrektur** Fachspec §6.5 |
| 6 | F10 ohne Korridor-Skip; `liegtImKinderzuschlagKorridor` entfällt | Abweichung Fachspec §4/§5 |
| 7 | Begründungen als `ReasonCode`, Texte in Teil C | Konvention (Zweisprachigkeit) |
| 8 | Fehlende Antwort → `CHECK_ADVISED` / `INSUFFICIENT_DATA`, nie `LIKELY_NO`; überschreibt §6.6 | Ergänzung |
| 9 | Verifikationsstand nur als Code-Kommentar, kein Banner, kein Laufzeitfeld | Vorgabe Auftraggeber |
| 10 | Regelbedarfsstufen-Zuordnung explizit festgelegt | Ergänzung, zu verifizieren |
| 11 | `today` injiziert, nie intern gelesen | Testbarkeit |

Punkt 5 ist eine sachliche Korrektur und sollte in die Fachspec zurückfließen. Punkte 3, 4,
6, 10 sind Abweichungen, die ich für richtig halte, aber jederzeit zurücknehme.

---

## 11. Vor Produktivsetzung zu klären

Die Checkliste der Fachspec §11 gilt unverändert und ist im Kopfkommentar von
`benefitRules.config.ts` verlinkt. Zusätzlich aus diesem Dokument:

- [ ] Zuordnung Haushaltsmitglied → Regelbedarfsstufe (§5) fachlich prüfen
- [ ] Entscheidung, ob Unterhaltsfelder an `users` oder `associated_persons` gehören
- [ ] Rückmeldung der Korrektur aus §6.5 an die Fachspec
