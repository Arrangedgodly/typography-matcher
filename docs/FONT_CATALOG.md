# Font catalog coverage

The deck contains 948 pairings and 1,804 unique Google Fonts families as of September 12, 2026.

The first 61 pairings remain the original editorial set. `npm run expand:fonts` preserves those records and regenerates every `catalog-*` record from `https://fonts.google.com/metadata/fonts`.

## Inclusion rules

A family enters the generated deck when it:

- includes the Latin subset used by the English specimen;
- belongs to Serif, Sans Serif, Display, Handwriting, or Monospace;
- has at least one upright weight between 100 and 900; and
- is not classified as Symbols.

This includes 1,804 of the 1,946 catalog families. The excluded set contains non-Latin-only families, symbols, barcodes, redaction faces, music notation, and Molle, whose only catalog face is italic and cannot be represented by the current upright-first loader.

## Pairing rules

The generator uses each eligible family at least once. It keeps families categorized or classified as display or handwriting in the heading slot. It assigns readable serif, sans-serif, or monospace bodies using category contrast, stroke thickness, width, and catalog popularity. When expressive headings outnumber unused reading families, it reuses a small group of popular bodies.

For each role, the generator selects up to two catalog-backed weights nearest the specimen's target weights. It requests body italics only when every selected body weight has a real italic face. IDs and output order are deterministic for the same metadata response.

## Verification

`npm run validate:fonts` requests every pairing from the live Google Fonts CSS API and compares the returned `@font-face` descriptors with every requested family, weight, and italic. It also samples up to 100 served WOFF2 files to verify the cache policy used by the prefetch buffer.

The full cache-policy check is sampled because all font files share the same Google-hosted delivery policy; family and face validation is exhaustive.
