# Knowledge base

Benefit eligibility rules as W3C standards (Turtle, SHACL, SPARQL), independent of any programming language. `libs/eligibility-engine` executes them; the wallet frontend runs the check in the browser.

| File | Contents |
|---|---|
| `definitions.ttl` | Classes, laws, providing agencies |
| `datafields.ttl` | Questions a citizen answers (`bf:DataField`) and facts derived from them (`bf:DerivedDataField`) |
| `constants.ttl` | Legal amounts with `bf:validFrom` and `bf:legalSource` |
| `materialization.ttl` | SPARQL rules deriving facts, e.g. age, Regelbedarf, whether savings stay within the allowance |
| `rules/*.ttl` | One requirement profile per benefit: metadata plus a SHACL shape |
| `beyondforms.ttl` | Links to the applications BeyondForms can fill |

## How a check works

1. The answers become RDF about `bf:Citizen` (and `bf:Child` individuals).
2. The materialization rules run in dependency order and add derived facts.
3. Each requirement profile's shape validates the citizen:
   - no violation: **eligible**
   - a violated value constraint (`sh:in`): **ineligible**, with the `bf:reasonKey` / `sh:message` of the rule
   - only `sh:minCount` violations: **missingData**
4. Missing derived facts are traced back through the rules' `bf:input` (then `bf:optionalInput`) to answerable data fields. The next question is the field missed by the most undecided benefits, ties broken by `bf:questionPriority`.

## Adding or changing a rule

- Every property shape needs `sh:minCount 1`, otherwise a missing answer passes silently. Shapes that decide eligibility also need `bf:reasonKey`, `sh:order` and `sh:message` in German and English.
- Put amounts in `constants.ttl`, never into a query. A new amount is a new `bf:Constant` in the existing series with its `bf:validFrom`; keep the old one.
- Every amount is `bf:verified false` until checked against the primary source.
- `cd libs/eligibility-engine && npm test` checks these conventions and compares the four original benefits with `benefitRules.ts`.

The namespace `https://beyond-forms.example/ns#` is a placeholder until BeyondForms has its own domain. Attribution: see [NOTICE.md](NOTICE.md).
