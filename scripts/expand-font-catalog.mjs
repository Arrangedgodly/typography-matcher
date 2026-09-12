import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const METADATA_URL = 'https://fonts.google.com/metadata/fonts'
const DATA_PATH = resolve('src/data/pairings.json')
const GENERATED_PREFIX = 'catalog-'
const CATEGORY = {
  'Serif': 'serif',
  'Sans Serif': 'sans-serif',
  'Display': 'display',
  'Handwriting': 'handwriting',
  'Monospace': 'monospace',
}

function flagValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}

async function loadMetadata() {
  const path = flagValue('--metadata')
  const raw = path
    ? readFileSync(resolve(path), 'utf8')
    : await fetch(METADATA_URL, { signal: AbortSignal.timeout(30_000) }).then((response) => {
        if (!response.ok) throw new Error(`Google Fonts metadata returned HTTP ${response.status}`)
        return response.text()
      })
  return JSON.parse(raw.replace(/^\)\]\}'\n?/, '')).familyMetadataList
}

function normalWeights(font) {
  return Object.keys(font.fonts)
    .filter((key) => /^\d+$/.test(key))
    .map(Number)
    .filter((weight) => weight >= 100 && weight <= 900)
    .sort((a, b) => a - b)
}

function nearest(weights, target) {
  return weights.reduce((best, weight) =>
    Math.abs(weight - target) < Math.abs(best - target) ? weight : best,
  )
}

function selectedWeights(font, role) {
  const available = normalWeights(font)
  const targets = role === 'heading' ? [700, 500] : [400, 600]
  return [...new Set(targets.map((target) => nearest(available, target)))].sort((a, b) => a - b)
}

function tagsFor(font) {
  const tags = {
    'Serif': ['serif', 'reading'],
    'Sans Serif': ['sans-serif', 'reading'],
    'Display': ['display', 'expressive'],
    'Handwriting': ['handwriting', 'expressive'],
    'Monospace': ['monospace', 'technical'],
  }[font.category]
  if (font.classifications?.includes('Display') && !tags.includes('display')) return [tags[0], 'display']
  if (font.classifications?.includes('Handwriting') && !tags.includes('handwriting')) return [tags[0], 'handwriting']
  return tags
}

function familyRecord(font, role) {
  const weights = selectedWeights(font, role)
  return {
    slug: font.family,
    role,
    category: CATEGORY[font.category],
    tags: tagsFor(font),
    weights,
    italic: role === 'body' && weights.every((weight) => `${weight}i` in font.fonts),
  }
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function metric(font, name, fallback) {
  const face = font.fonts['400'] ?? Object.values(font.fonts)[0]
  return Number(face?.[name] ?? fallback)
}

function compatibility(heading, body) {
  const h = CATEGORY[heading.category]
  const b = CATEGORY[body.category]
  let score = 0
  if (['display', 'handwriting'].includes(h) && ['serif', 'sans-serif'].includes(b)) score += 200
  if ((h === 'serif' && b === 'sans-serif') || (h === 'sans-serif' && b === 'serif')) score += 150
  if (h === 'monospace' && ['serif', 'sans-serif'].includes(b)) score += 120
  if (h !== b) score += 40
  score += Math.abs(metric(heading, 'thickness', 5) - metric(body, 'thickness', 5)) * 3
  score += Math.abs(metric(heading, 'width', 5) - metric(body, 'width', 5)) * 2
  score -= Math.min(body.popularity ?? 2000, 2000) / 100
  return score
}

function bestBody(heading, candidates) {
  let bestIndex = 0
  let bestScore = -Infinity
  for (let index = 0; index < candidates.length; index += 1) {
    const score = compatibility(heading, candidates[index])
    if (score > bestScore) {
      bestIndex = index
      bestScore = score
    }
  }
  return candidates.splice(bestIndex, 1)[0]
}

function makePairing(heading, body, usedIds) {
  const base = `${GENERATED_PREFIX}${slugify(heading.family)}-${slugify(body.family)}`
  let id = base
  let suffix = 2
  while (usedIds.has(id)) id = `${base}-${suffix++}`
  usedIds.add(id)
  return { id, heading: familyRecord(heading, 'heading'), body: familyRecord(body, 'body') }
}

const metadata = await loadMetadata()
const existing = JSON.parse(readFileSync(DATA_PATH, 'utf8')).filter(
  (pairing) => !pairing.id.startsWith(GENERATED_PREFIX),
)
const existingFamilies = new Set(existing.flatMap((pairing) => [pairing.heading.slug, pairing.body.slug]))
const eligible = metadata.filter(
  (font) =>
    font.subsets.includes('latin') &&
    CATEGORY[font.category] &&
    !font.classifications?.includes('Symbols') &&
    normalWeights(font).length > 0,
)
const fresh = eligible
  .filter((font) => !existingFamilies.has(font.family))
  .sort((a, b) => a.family.localeCompare(b.family, 'en'))
const isExpressive = (font) =>
  ['Display', 'Handwriting'].includes(font.category) ||
  font.classifications?.some((classification) => ['Display', 'Handwriting'].includes(classification))
const expressive = fresh.filter(isExpressive)
const text = fresh.filter((font) => !isExpressive(font))
const generated = []
const usedIds = new Set(existing.map((pairing) => pairing.id))

// A few of the catalog's sans/serif families are explicitly classified as
// display faces. Keep all of those in the heading slot. Reuse a small set of
// popular reading families when there are more expressive faces than unique
// text bodies; every eligible family still appears at least once.
const additionalBodiesNeeded = Math.max(0, expressive.length - text.length)
const reusableBodies = eligible
  .filter((font) => !isExpressive(font))
  .sort((a, b) => (a.popularity ?? 9999) - (b.popularity ?? 9999) || a.family.localeCompare(b.family, 'en'))
  .slice(0, additionalBodiesNeeded)
const bodyPool = [...text, ...reusableBodies]
for (const heading of expressive) generated.push(makePairing(heading, bestBody(heading, bodyPool), usedIds))
text.length = 0
while (text.length > 1) {
  const heading = text.shift()
  generated.push(makePairing(heading, bestBody(heading, text), usedIds))
}
if (text.length === 1) {
  const fallbackBodies = eligible.filter(
    (font) => ['Serif', 'Sans Serif'].includes(font.category) && font.family !== text[0].family,
  )
  generated.push(makePairing(text[0], bestBody(text[0], fallbackBodies), usedIds))
}

const output = [...existing, ...generated]
writeFileSync(DATA_PATH, `${JSON.stringify(output, null, 2)}\n`)
const outputFamilies = new Set(output.flatMap((pairing) => [pairing.heading.slug, pairing.body.slug]))
const missing = eligible.filter((font) => !outputFamilies.has(font.family))
console.log(
  JSON.stringify(
    {
      metadataFamilies: metadata.length,
      eligibleLatinTextFamilies: eligible.length,
      preservedEditorialPairings: existing.length,
      generatedPairings: generated.length,
      totalPairings: output.length,
      uniqueFamilies: outputFamilies.size,
      excludedNonLatinOrSymbols: metadata.length - eligible.length,
      missingEligibleFamilies: missing.map((font) => font.family),
    },
    null,
    2,
  ),
)
