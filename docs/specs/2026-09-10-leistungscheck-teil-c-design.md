# Leistungscheck — Teil C: Ergebnisansicht und Profil-Übertragung

**Datum:** 2026-09-10
**Status:** Entwurf, zur Abnahme
**Grundlage:** `leistungscheck-agent-spezifikation.md` (Fachspec), Teil A und Teil B unter `docs/specs/`

---

## 1. Zweck und Abgrenzung

Teil A liefert die Entscheidungslogik, Teil B den Fragebogen. Teil C schließt die Kette:
das Ergebnis wird lesbar, und die Antworten landen im Profil.

### In Teil C enthalten

- Gestaltete Ergebnisansicht statt der Übergangslösung aus Teil B (§2)
- Copy für Leistungsnamen, Status, Begründungscodes, Hinweise, Disclaimer (§3)
- Verweis-Block für den Fall, dass keine Leistung passt (§4)
- Übertragung der Kinder nach `associated_persons`, mit Zusammenführung (§6)
- Manuelle Abnahme gegen zwei Demo-Personas (§8)

### Nicht in Teil C

| Thema | Wo |
|---|---|
| Die fünf Datenlücken (Brutto, Vermögensband, Unterhalt ×2, Warmmiete) | offen, warten auf das Backend |
| Aufräumen der toten Locale-Schlüssel (`outcome/`, `feature_cards`, `back_aria`) | eigener Commit, Entscheidung steht aus |
| Rules Engine, Middleware, Migrationen | außerhalb |

---

## 2. Ergebnisansicht

**Nachtrag 2026-09-10:** Die flache Liste unten ist überholt. Die Seite sortiert jetzt
nach Status — `LIKELY_YES`, `CHECK_ADVISED`, `LIKELY_NO` —, der Sort ist stabil, innerhalb
einer Gruppe bleibt die Reihenfolge der Engine. `NOT_APPLICABLE` liegt hinter einem
Aufklapper („N Leistungen betreffen Deine Situation nicht"). Die Begründungen sind
eingeklappt und öffnen sich per Antippen der Karte, nicht per Hover: auf dem Telefon, für
das die Ansicht ausgelegt ist, gäbe es sonst keinen Weg zu ihnen. Status trägt ein Symbol
(Haken / Fragezeichen / X). `LIKELY_YES` bekommt „Jetzt beantragen", `CHECK_ADVISED`
„Jetzt Anspruch prüfen"; beide Ziele sind noch Platzhalter. Es sind sieben Karten, nicht
sechs — das Bildungs- und Teilhabepaket ist vom Hinweis zur Leistung geworden
(Teil-A-Design §7).

Flache Liste, feste Reihenfolge. Die Engine liefert die sechs Bewertungen bereits in
stabiler Ordnung (`BenefitId`), die Ansicht rendert sie unverändert durch. Kein
Umsortieren nach Status.

Jede Karte folgt dem bestehenden Muster aus `DocumentStatusListItem`
(`bg-white rounded-xl border border-brand-border-subtle shadow-cards`) und enthält
Leistungsnamen, Status-Label und die Begründungen im Klartext.

### Status-Darstellung

Farbe wird **immer** mit Text gepaart, nie allein — sonst ist der Status für
farbenblinde Nutzende und mit Screenreader nicht erkennbar.

| Status | Darstellung | Label (Fachspec §8) |
|---|---|---|
| `LIKELY_YES` | `CheckCircleIcon`, `text-primary-blue-500` | „Das lohnt sich" |
| `CHECK_ADVISED` | `text-secondary-orange-500`, kein Symbol | „Das solltest Du prüfen lassen" |
| `LIKELY_NO` | `text-brand-grey`, kein Symbol | „Trifft bei Dir vermutlich nicht zu" |
| `NOT_APPLICABLE` | gedämpfte Karte, kein Symbol, kein Akzent | „Betrifft Deine Situation nicht" |

Die Dämpfung von `NOT_APPLICABLE` setzt Fachspec §8 um („sollte **nicht** wie eine
Ablehnung wirken"). Sie ist zugleich die Abmilderung für den bekannten Nachteil der
flachen Liste: bei einem typischen Ergebnis stehen mehrere Nicht-Treffer über dem einen
Treffer. Die Karte bleibt sichtbar und lesbar, tritt aber optisch zurück.

Begründungen werden auch bei `NOT_APPLICABLE` gezeigt — „Du hast die Regelaltersgrenze
noch nicht erreicht" ist eine Information, keine Zurückweisung.

### Aufbau der Seite

1. Überschrift
2. Die sechs Karten in fester Reihenfolge
3. Verweis-Block, nur bei null Treffern (§4)
4. Hinweise aus `BenefitCheckResult.hints`, sofern vorhanden
5. Weiter-Button (§5)
6. Disclaimer

Der Disclaimer wird **unbedingt** gerendert und stammt aus i18n, nicht aus dem
Ergebnisobjekt. So kann er nicht fehlen, weil die Engine ihn vergessen hat — das war
schon in Teil A die Begründung dafür, ihn nicht in `BenefitCheckResult` zu führen.

---

## 3. Copy

Neuer Block `result.*` in `src/locales/{de,en}/eligibility.json`:

| Gruppe | Anzahl |
|---|---|
| Leistungsnamen (`BenefitId`) | 6 |
| Status-Label (`BenefitStatus`) | 4 |
| Begründungen (`ReasonCode`) | 25 |
| Hinweise (`HintCode`) | 3 |
| Überschrift, Disclaimer, Verweis-Block, Button | 5 |

Rund 43 Bausteine je Sprache. Ein Test vergleicht die Copy gegen die Enums aus
`benefitCheck.schema.ts` — fehlt ein Code, schlägt die Suite fehl, statt einer
antragstellenden Person einen rohen Schlüssel zu zeigen. Dasselbe Muster wie
`questionCopy.test.ts` aus Teil B.

Tonlage wie im Rest der App: kurze Hauptsätze, „Du" groß, keine Amtsbegriffe ohne
Erklärung. Die Status-Formulierungen übernehmen Fachspec §8 sinngemäß, in der
Du-Ansprache.

**Die Copy ist ein Vorschlag und braucht menschliche Prüfung, bevor sie Nutzer erreicht.**

---

## 4. Verweis bei null Treffern

Ist keine der sechs Leistungen `LIKELY_YES` oder `CHECK_ADVISED`, zeigt die Seite einen
Verweis-Block mit dem vorhandenen `EXTERNAL_LINKS.SOZIALAMT`-Link.

Das ersetzt den `sozialamt`-Ausgang des alten Checks und fängt die Gruppe auf, die sonst
eine Liste aus sechs Absagen ohne nächsten Schritt vor sich hätte — also gerade die
Menschen, die am ehesten Beratung brauchen.

**Diese Regel steht nicht in der Fachspec.** Sie ist eine Ergänzung dieses Dokuments,
abgestimmt am 2026-09-10.

---

## 5. Weiter-Button

Ziel bleibt `/profile?origin=eligibility`, unverändert gegenüber dem alten Check.

Der Grund ist mechanisch: `ProtectedRoute` leitet unangemeldete Nutzende auf
`${AppRoutes.Auth}${location.search}` weiter und **behält dabei den Query-String**. So
kommt `origin=eligibility` bei `AuthView` an, und nur dann feuert der Gast-Sync. Ein
anderes Ziel würde die Übertragung still abschalten.

---

## 6. Kinder nach `associated_persons`

### Ausgangslage

Das Frontend schreibt `associated_persons` heute nirgends. Nur der Chat-Assistent (über
`update_user_data`) und das Demo-Seeding tun das. Das Endpoint **ersetzt die Kollektion
vollständig** — der Kommentar in `user_service.py` sagt das ausdrücklich, damit die
festen Personenfelder der PDFs nicht verrutschen.

Ein Sync, der nur die Kinder schickt, würde also eine vom Chat angelegte Partnerin
löschen. Der Sync feuert auch für wiederkehrende Nutzende, das Risiko ist real.

### Mechanik

Ein rohes `GET` auf `/profile` in `application.service.ts`, dann Zusammenführung, dann
das bestehende `POST`.

**Warum nicht über `profileService.getProfile()`:** der Frontend-Typ `Profile` hat kein
`associatedPersons`; `mapProfileToFrontend` wirft das Feld weg. `GET /profile` liefert es
im rohen JSON (`routes/user.py` hängt es explizit an), nur das Frontend-Schema kennt es
nicht.

**Warum `ProfileSchema` nicht erweitert wird:** `mapProfileToBackend` flacht jeden
Abschnitt in den Payload ab. Sobald `associatedPersons` ein Abschnitt wäre, würde jedes
Profil-Speichern die Kollektion mitschicken — und das Endpoint ersetzt sie. Ein
veralteter Frontend-Stand könnte damit still den Haushalt einer Person löschen. Das wäre
eine größere Gefahr als die, die hier vermieden werden soll. Der Radius bleibt deshalb
bewusst auf eine Datei beschränkt.

### Zusammenführung

Reine Funktion `mergeChildren(existing, children)`:

1. Vorhandene Zeilen **in ihrer Reihenfolge** durchgehen:
   - Zeilen mit `association_type !== "Child"` behalten
   - Kind-Zeilen behalten, wenn ihr `date_of_birth` in der Prüfung vorkommt (erster noch
     nicht verbrauchter Treffer) — so bleiben bereits erfasste Namen erhalten
2. Kinder aus der Prüfung ohne Treffer hinten anhängen, als
   `{ association_type: "Child", lives_in_household: true, date_of_birth }`
3. Kind-Zeilen ohne Treffer entfallen — die Person hat gerade gesagt, wer im Haushalt lebt
4. `sort_order` am Ende nach Listenposition neu vergeben, damit der Payload in sich
   stimmig ist. Der Server tut dasselbe; die Reihenfolge bleibt maximal erhalten, weil
   behaltene Zeilen ihre relative Position nicht ändern.

`sort_order` und `lives_in_household` sind in `AssociatedPersonSchema` Pflichtfelder und
müssen deshalb im Payload stehen, auch wenn der Server `sort_order` überschreibt.

### Fallback

Schlägt der `GET` fehl, werden die Kinder **weggelassen** und alle anderen Felder
trotzdem gesendet. Der schlechteste Fall ist damit exakt der Zustand nach Teil B — nie
ein Datenverlust. Mit Test abgesichert.

---

## 7. Was die Übertragung weiterhin auslässt

Unverändert aus Teil A §9 und Teil B: fünf Antworten haben kein Zielfeld und werden
bewusst nicht gesendet, jeweils mit `GAP:` markiert.

`monthlyGrossIncome`, `assetsBand`, `childReceivesFullSupport`,
`monthsWithoutChildSupport`, `monthlyWarmRent`.

Ein Payload mit diesen Feldern liefert HTTP 200 und verwirft sie stillschweigend, weil
`UserProfileValidationSchema` kein `extra="forbid"` setzt. Weglassen ist ehrlicher als
hoffnungsvoll mitsenden.

---

## 8. Manuelle Abnahme

Der Sync ist der einzige Teil, der ein Backend braucht — und er braucht **kein Vertex AI**.
Gemini-Zugangsdaten sind nur für Chat, OCR und RAG nötig; das steht so auch in
`demo/README.md`. `docker compose up -d` genügt und seedet die Demo-Personas mit.

Alles andere aus Teil C (Ergebnisansicht, Copy, Status, Verweis-Block, beide Sprachen)
läuft mit `npm run dev` allein.

Zwei Personas decken die beiden Kanten der Zusammenführung ab:

| Persona | Nummer | Ausgangslage | Erwartung nach dem Check |
|---|---|---|---|
| **Helmut** | `+493023125102` | 1 × `Spouse` **Ingrid** | Ingrid ist **noch da**, die Kinder sind dazugekommen |
| **Sabine** | `+493023125101` | keine `associated_persons` | die Kinder sind sauber neu angelegt |

Ablauf je Persona: Check als Haushalt mit Kindern durchlaufen, über den Weiter-Button
anmelden (Drama-Nummern umgehen die SMS, jeder Code funktioniert), danach
`GET /profile` prüfen oder `./scripts/demo_token.sh` nutzen.

Helmut ist der eigentliche Prüffall: er bildet genau das Datenverlust-Szenario ab, um
das es in §6 geht, an einem echten Datensatz statt in einem Unit-Test.

---

## 9. Was entfernt wird

Die Übergangsansicht aus Teil B mitsamt ihrem gelben Baustellen-Hinweis
(`provisional-notice`) und den rohen Enum-Ausgaben.

**Nicht** mit aufgeräumt werden die toten Locale-Schlüssel (`outcome/`,
`start_screen.feature_cards`, `back_aria`) und die sieben toten Einträge in
`i18nKeys.ts`. Das ist eine offene Entscheidung des Auftraggebers und gehört in einen
eigenen Commit; bei `start_screen.currently_available` ist es zudem eine
Produktentscheidung, keine Bereinigung.

---

## 10. Tests

| Bereich | Fälle |
|---|---|
| `mergeChildren` | leere Kollektion; nur Partner vorhanden; Namenserhalt bei DOB-Treffer; neues Kind wird angehängt; nicht mehr genanntes Kind entfällt; Reihenfolge bleibt; `sort_order` lückenlos ab 0 |
| Sync | `GET` schlägt fehl → Kinder fehlen, übrige Felder werden gesendet; `GET` liefert leere Kollektion → Kinder werden angelegt |
| Ergebnisansicht | alle sechs in fester Reihenfolge; `NOT_APPLICABLE` gedämpft und ohne Symbol; Disclaimer immer vorhanden; Hinweise nur wenn vorhanden |
| Verweis-Block | erscheint bei null Treffern; erscheint **nicht**, sobald eine Leistung `LIKELY_YES` oder `CHECK_ADVISED` ist |
| Copy | jeder `BenefitId`, `BenefitStatus`, `ReasonCode` und `HintCode` hat Text in `de` **und** `en`; keine verwaisten Blöcke |

Erwartung: die Suite bleibt bei genau einem roten Test, dem vorbestehenden
`ApplicationOverview.test.tsx`.

---

## 11. Entscheidungen und Abweichungen

| # | Festlegung | Art |
|---|---|---|
| 1 | Flache Liste in fester Reihenfolge statt Gruppierung nach Status | Vorgabe Auftraggeber |
| 2 | `NOT_APPLICABLE` gedämpft, aber sichtbar | Fachspec §8 |
| 3 | Kinder werden über das Geburtsdatum zusammengeführt, Partner bleiben unangetastet | Vorgabe Auftraggeber |
| 4 | Rohes `GET` statt `profileService`; `ProfileSchema` bleibt unverändert | **Korrektur** einer falschen Annahme in der Vorbesprechung |
| 5 | Fallback: `GET` scheitert → Kinder weglassen, Rest senden | Ergänzung |
| 6 | Verweis-Block bei null Treffern | **Ergänzung**, nicht in der Fachspec |
| 7 | Disclaimer aus i18n, nicht aus dem Ergebnisobjekt | übernommen aus Teil A |
| 8 | Weiter-Button behält `/profile?origin=eligibility` | erzwungen durch `ProtectedRoute` |

Punkt 4 ist eine Korrektur: in der Vorbesprechung hatte ich `profileService.getProfile()`
vorgeschlagen und behauptet, der `MockProfileService` mache die Zusammenführung lokal
erprobbar. Beides war falsch — der Frontend-Typ führt das Feld nicht, und mit Mocks
steigt der Sync ohnehin vor jedem Netzwerkaufruf aus.

---

## 12. Offen

- Die Copy für rund 43 Bausteine je Sprache ist ein Vorschlag und braucht menschliche
  Prüfung.
- Die Verifikationsliste aus Teil A §11 bleibt unverändert offen; die Rechtskonstanten
  sind weiterhin unverifiziert, und die Ergebnisansicht zeigt daraus abgeleitete Aussagen.
- Die fünf Datenlücken warten auf die Backend-Entscheidung.
