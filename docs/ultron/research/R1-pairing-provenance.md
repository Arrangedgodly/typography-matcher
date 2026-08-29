# R1 — Pairing Provenance & Licensing Disposition

## Question + affected task IDs

**Question:** May the embedded ~60-pairing JSON dataset lawfully/pragmatically derive from third-party pairing galleries' selections (fontpair.co, Typewolf, fontpairings, happyhues) or from Google Fonts' own popularity/metadata endpoints — or must pairings be independently composed? Where derivation is permitted, what attribution is required or customary?

**Affected tasks:**
- **T13** (Research · Provenance & licensing disposition) — this record is T13's deliverable; disposition below.
- **T14** (Program · Curate ~60 pairings → `src/data/pairings.json`) — blocked by T13 only; T14 must follow the operative rules in "Implementation consequences."

## Constraints / criteria

- Dataset embedded in the app bundle, shipped from a **public GitHub repo** via GitHub Pages. Everything in the repo is inspectable and forkable — defensibility is judged in public.
- All fonts themselves are Google Fonts (OFL 1.1 / Apache 2.0). **The pairing data — selections/recommendations — is the question**, not font files.
- Commercial-neutral, no accounts, no analytics. Pairings are consumed blind (identities hidden until saved), which is orthogonal to provenance but means the shipped artifact is pure structured data: `{heading, body, tags, weights}` per pairing.
- Evaluation: legal exposure (ToS, compilation copyright, database rights), community norms/attribution customs, practicality, defensibility.

## Options considered

### Option A — Derive from an openly-licensed gallery repo, with attribution
The only genuinely open pairing dataset found: **wishnwv/Font-Pair** (formerly itsvvishnu/Font-Pair), MIT licensed ("Copyright (c) 2020 Vishnu V"), community-contributed via `app/src/fonts.js`.
- **Fit: poor.** It contains **18 pairings**, not ~60; no category tags; no weights field (weights only appear incidentally inside Google Fonts URLs); mixed quality (e.g. "Romanesco & Open Sans" — decorative display + body with no recorded rationale; contributor handles are the only provenance).
- **Effort:** MIT compliance is trivial (retain copyright + license text), but T14 would still need to compose ~42+ additional pairings, tag everything, and curate weights — the hard work is unchanged.
- **Risk:** minimal legally; but shipping a dataset visibly seeded from an 18-item hobby repo adds an attribution obligation without buying quality.
- **Preferable only if** the project wanted a legal quick-seed and accepted shipping MIT-noticed third-party data. It cannot satisfy ~60 alone.

### Option B — Derive from commercial galleries' selections (fontpair.co, Typewolf, fontpairings.net, happyhues)
- **Explicitly foreclosed by the galleries' own terms** (see Evidence): fontpair.co — "You may not copy, distribute, or exploit any part of the Service without permission"; fontpairings.net — "original content (excluding fonts)... will remain the exclusive property of FontPairings" and "You may not... scrape, crawl, or spider any content"; Typewolf — no license granted at all, pairings monetized directly (paid lookbooks, affiliate commissions), footer "© 2013–2026 Jeremiah Shoaf"; Happy Hues — "©2021 Mackenzie Child. All Rights Reserved."
- **Copyright:** a curated "best pairings" list is a compilation; wholesale reproduction copies the *selection and arrangement*, which is exactly what Feist protects even when the individual pairings (facts) are free. Copying a gallery's full free-tier list, or its ordering, replicates the protectable curation layer. EU database right (Dir. 96/9/EC Art. 7) adds extratiction risk for a "substantial part" (qualitatively judged) if served globally from GitHub Pages.
- **Norms:** fontpair.co sells its curated list ($8/mo Pro, "500+ curated font pairings"); Typewolf sells lookbooks as its primary revenue. Bulk-copying a competitor-adjacent curation product is both an exposure and a community-relations failure for a public repo.
- **Preferable only if** no. **Rejected.** Important nuance: an *individual* pairing that appears across multiple galleries is an unprotectable fact/common recommendation — Option B fails at the "derive the list" level, not at the level of any single combination.

### Option C — Independent curation using Google Fonts popularity/metadata + own editorial judgment (galleries as inspiration only)
- **Fit: exact.** T14's acceptance criterion ("spot-render of 10 random pairings looks intentional — typography-domain check") already demands editorial judgment regardless of source. Google's metadata supplies the objective scaffolding: candidate families, categories, available weights — all facts.
- **Effort:** highest editorial effort, but that effort was always in T14's scope; metadata pulls make candidate selection fast (popularity-sorted pool, category spread).
- **Risk:** minimal. Family names, categories, weights, and popularity scores are facts (Feist); the curation expressed in `pairings.json` is the project's own original selection.
- **Preferable when:** always, given A can't reach ~60 and B is foreclosed.

### Hybrid (C core, A optional seed) — **RECOMMENDED**
Option C as the disposition, with two softeners: (1) the MIT-licensed Font-Pair list and gallery pages may be *read* as inspiration — any individual pairing that is independently judged to meet the quality bar may ship, because individual pairings are unprotectable facts; (2) no single proprietary gallery's list may be bulk-converted, and no gallery's ordering/ranking may be reproduced. If any verbatim contribution from the MIT repo is actually copied in a structured way, ship its MIT notice; simplest path is not to.

## Recommendation + rationale

**RECOMMENDED: Hybrid — independent editorial curation (Option C), with galleries lawful as per-pairing inspiration only, and Google Fonts metadata/popularity as the candidate pool. No derivation from any proprietary gallery's list; no scraping of anything; attribution ships as a courtesy "Credits" note, not a legal requirement.**

Rationale:
1. **The law draws the line exactly where this disposition draws it.** Individual pairings ("Playfair Display + Source Sans Pro") are facts/ideas — uncopyrightable no matter who lists them (Feist: "facts are not copyrightable"; a later compiler "stays free to use another's facts"). What Feist *does* protect is "the same selection and arrangement" — i.e., bulk-reproducing a gallery's curated set. Deriving-the-list is foreclosed; being-inspired-per-pairing is free.
2. **Every major gallery's terms confirm they intend to keep the curation layer proprietary** (exact quotes in Evidence). None grants a license; fontpairings.net even disclaims font ownership while claiming the curation: "We provide a curation and pairing service only" — the pairing service is precisely what their terms reserve.
3. **Google Fonts' own data is the one source that is both lawful and sufficient.** The metadata is public, unauthenticated, fact-based, and mirrored in the openly-licensed `google/fonts` GitHub repo (license indicated by top-level directory: `ofl/`, `apache/`). Popularity is an objective ranking, not editorial expression.
4. **The product's differentiation argument depends on it.** PRODUCT.md positions the tool against name-first galleries; its pairing list being *own editorial judgment* (blind-tested, quality-barred) is consistent with that positioning and with T14's acceptance test. A list visibly scraped from fontpair.co would undercut both defensibility and the brand.
5. **Community norm check:** galleries link to each other and to Google Fonts as citation/courtesy; tools in this space credit Google Fonts for the typefaces. A "Credits / Sources" README section naming inspiration sources and Google Fonts matches custom without conceding any obligation.

## Evidence

All primary sources accessed **2026-08-28**.

1. **Fontpair Terms of Service** — https://fontpair.co/terms (effective Aug 21, 2025; operator Flyover LLC, Indiana).
   - "All trademarks, logos, and content on Fontpair (other than User Content) are owned by or licensed to Flyover LLC."
   - "You may not copy, distribute, or exploit any part of the Service without permission."
   - Acceptable Use bars attempts to "Reverse-engineer or misuse our software or APIs."
   - No license is granted to users over pairing data; no attribution mechanism exists.
   - Supports: Option B foreclosed (ToS + proprietary claim over curated content). Pricing page (fontpair.co/pricing): Pro $8/month for "full access to 500+ curated font pairings" — the curation is their commercial product.

2. **Typewolf About** — https://www.typewolf.com/about.
   - Footer: "© 2013–2026 Jeremiah Shoaf." No terms-of-use page surfaced; no reuse license stated anywhere.
   - Monetization: "The preferred way to support Typewolf is to purchase one of my products"; MyFonts affiliate commissions. Lookbooks (typewolf.com/lookbooks) are paid PDF pairing products — the pairing recommendations are the site's revenue.
   - Editorial claim: "Typewolf will always remain an independent site that features typefaces from all type foundries."
   - Supports: no license granted ⇒ default "all rights reserved"; derivation not permitted.

3. **FontPairings.net Terms of Service** — http://www.fontpairings.net/terms (last updated January 2025).
   - §6 prohibits using the Service "To scrape, crawl, or spider any content from the Service."
   - §7: "original content (excluding fonts), features, and functionality are and will remain the exclusive property of FontPairings."
   - §5: "All fonts featured on FontPairings are sourced from Google Fonts and are available under the SIL Open Font License (OFL)... FontPairings does not claim ownership of any fonts. We provide a curation and pairing service only."
   - Supports: explicit anti-scraping; the curation layer is claimed even though fonts are not.

4. **Happy Hues** — https://www.happyhues.co/ (Mackenzie Child). Footer: "©2021 Mackenzie Child. All Rights Reserved." No reuse license or attribution request stated. Category precedent only (color palettes, not font pairings): curated-gallery default is all-rights-reserved.

5. **wishnwv/Font-Pair** (MIT) — https://github.com/wishnwv/Font-Pair (redirected from itsvvishnu/Font-Pair). LICENSE: MIT, "Copyright (c) 2020 Vishnu V." Dataset `app/src/fonts.js`: 18 community-contributed pairings, fields `{title, primary, secondary, git, url}`.
   - Supports: the only found openly-licensed pairing dataset; too small and too thin (no tags/weights) to be the source, viable as inspiration without obligation; structured copying would require shipping MIT notice.

6. **Google Fonts metadata endpoint** — `GET https://fonts.google.com/metadata/fonts` (unauthenticated curl, 2026-08-28): 1,946 families; per-family fields include `category`, `classifications`, `popularity`, `fonts` (weights/styles), `isOpenSource`, `designers`, `dateAdded`, `languages`. This is the feed fonts.google.com itself renders from.
   - Supports: objective, fact-based candidate pool (names, categories, weights, popularity) for Option C.

7. **google/fonts GitHub repo** — https://github.com/google/fonts (20,425 stars; no repo-level license object).
   - README: "The top-level directories indicate the license of all files found within them" (i.e., `ofl/` ⇒ OFL 1.1, `apache/` ⇒ Apache 2.0); each family dir contains `METADATA.pb` (category, designers, license) and `DESCRIPTION.en_us.html`.
   - Supports: an unambiguous open mirror of the same facts, if a scripted pipeline ever needs one; human-scale curation can simply read the site.

8. **Google Fonts CSS2 API docs + terms** — https://developers.google.com/fonts/docs/css2 (page content CC BY 4.0; code samples Apache 2.0; no usage restrictions on the page) and https://developers.google.com/fonts/terms (last modified Nov 9, 2021): "By using this API, you consent to be bound by the Google API Terms of Service."
   - Supports: the CSS API (the project's declared runtime dependency) carries no pairing-data restrictions; nothing in Google's terms restricts using factual metadata about the catalog.

9. **17 U.S.C. § 101** — https://www.law.cornell.edu/uscode/text/17/101: a "compilation" is "a work formed by the collection and assembling of preexisting materials or of data that are selected, coordinated, or arranged in such a way that the resulting work as a whole constitutes an original work of authorship."
   - Supports: protection for a pairing list lives only in its selection/coordination/arrangement.

10. **Feist Publications, Inc. v. Rural Telephone Service Co., 499 U.S. 340 (1991)** — summarized via https://en.wikipedia.org/wiki/Feist_Publications,_Inc.,_v._Rural_Telephone_Service_Co. (opinion quotes): "facts are not copyrightable"; compilation copyright reaches "only to the creative aspects of collection"; a later compiler "stays free to use another's facts" provided the competing work does "not feature the same selection and arrangement"; "The sine qua non of copyright is originality" (a "minimal degree" suffices); "sweat of the brow" rejected.
    - Supports: individual pairings = free facts; wholesale copying of a curated list = infringement of the selection layer. This is the decisive legal authority.

11. **EU Database Directive 96/9/EC, Art. 7** (sui generis right) — via secondary sources (ResearchGate/CRS summaries): prohibits unauthorized "extraction and/or re-utilization of a substantial part" of a database in which there was substantial investment (qualitative or quantitative). No US equivalent; all named galleries are US-operated.
    - Supports: residual exposure if a substantially-valuable curated DB were bulk-extracted and served globally; irrelevant to independent curation of 60 facts.

## Tradeoffs / risks / confidence

- **Tradeoff:** Option C costs the most editorial effort of the three — but A cannot reach ~60 items and B is off the table, so the effort comparison is moot; T14 was scoped as `medium` with a typography-domain quality gate, which presupposes this work.
- **Residual risks:**
  - (Low) A gallery operator claims the ~60 list mirrors their free-tier selection. Mitigations: compose independently, keep a per-pairing rationale (even one line) in the curation working notes; ensure the list isn't a rank-ordered clone of any single gallery; individual overlapping pairings are unprotectable facts, and overlap with *common* recommendations is unavoidable and lawful.
  - (Low) Google metadata endpoint is undocumented/internal; a strict ToS reading might frown at scripted access. Mitigation: no scraping script needs to ship or run — a human curator reads fonts.google.com (popularity sort, category filters) during T14; if automation is ever wanted, use the `google/fonts` GitHub mirror instead.
  - (Negligible) EU database right: applies to extraction from protected databases; independent curation of 60 pairings from facts triggers none.
- **Confidence: HIGH** on the legal framework (Feist/compilation doctrine is settled; the galleries' ToS texts are explicit and were read directly) and on the recommendation. **Medium-high** on the Google-endpoint pragmatics (endpoints could change shape; mitigated by the GitHub mirror). Not legal advice; no attorney was consulted.

## Implementation consequences + plan updates

**What T14 must do (operative rules):**
1. Build the candidate pool from Google Fonts facts: popularity-ranked families with `isOpenSource`, balanced across categories (serif / sans-serif / display / monospace / handwriting). Use fonts.google.com interactively or the `google/fonts` repo; do not scrape gallery sites; do not script against undocumented Google endpoints in the repo.
2. Compose each of the ~60 pairings by the project's own typography judgment (contrast/harmony rationale per pairing, recorded in the curation notes). Consulting gallery sites for *inspiration* is permitted and lawful at the individual-pairing level; **never bulk-convert any single gallery's list or reproduce any gallery's ordering/ranking**; as a self-imposed safe harbor, no more than ~20% of shipped pairings should be traceable to any one proprietary gallery, and only where each also stands on its own merits (or appears in ≥2 independent sources).
3. Verify every family slug against the Google Fonts CSS API (this is T15's validation anyway); take weights/styles from the catalog's actual available weights (facts).
4. Do **not** copy `wishnwv/Font-Pair`'s file; if any pairing is knowingly retained from it after independent evaluation, no obligation arises (individual pairings are facts; MIT covers the *file/expression*, not the two-name combinations) — but do not reproduce its code/data file wholesale.

**What ships in the repo (attribution):**
- No legally required attribution for the pairing selections. Ship a courtesy note, e.g. in README or a short `CREDITS` section: "All typefaces are served via Google Fonts under their OFL/Apache licenses. Pairings are this project's own editorial selections, informed by Google Fonts catalog data and by common recommendations in the design community (fontpair.co, Typewolf, and others)."
- Keep per-pairing one-line rationales in the working notes (not necessarily shipped) to evidence independent creation if ever challenged.

**Plan updates:** T13 can be marked resolved by this disposition (R1 answered); T14 unblocked to proceed under the operative rules above. No change to T15 (slug/weight validation already enforces fact-correctness).

## Decision priority + status

- **Priority:** High — T13 blocks T14 only, which feeds M4 (Dataset) on the critical path into T16.
- **Status:** RESOLVED (research disposition). Recommendation: independent curation (Option C/hybrid); galleries = per-pairing inspiration only, never list-level derivation; Google Fonts facts = candidate pool; courtesy credits note ships, no legal attribution required.

## Delegation record

- Researched and written by: R1 research subagent (ZCode), 2026-08-28.
- Primary sources consulted live on 2026-08-28: fontpair.co/terms, typewolf.com/about, fontpairings.net/terms, happyhues.co, github.com/wishnwv/Font-Pair (LICENSE + fonts.js), fonts.google.com/metadata/fonts, github.com/google/fonts (README), developers.google.com/fonts/docs/css2, developers.google.com/fonts/terms, law.cornell.edu/uscode/text/17/101, Feist v. Rural (499 U.S. 340) summary, EU Dir. 96/9/EC secondary sources.
