// SPEC §T9: UI text must come from the en/ur JSON. Flags letters written straight into JSX:
// text between tags and user-visible attributes. shadcn primitives (components/ui) are skipped.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../apps/web/src/', import.meta.url).pathname
const SKIP_DIRS = new Set(['ui', 'locales'])
const LETTERS = /[A-Za-z؀-ۿ]{2,}/
// `>` of a tag (not `=>`/`->`) up to the next `<` that opens or closes a tag.
const TEXT = /(?<![=-])>([^<>{}]*)<(?=[/A-Za-z])/g
const ATTR = /\b(placeholder|title|aria-label|alt|label)="([^"]*)"/g
// Codes and units that read the same in both languages.
const ALLOWED = new Set(['Rs', 'PIN', 'CNIC', 'TRN', 'A4', 'mm', 'Ctrl', 'Enter'])

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p)
    } else if (p.endsWith('.tsx')) files.push(p)
  }
}
walk(ROOT)

const hits = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lineOf = (i) => src.slice(0, i).split('\n').length
  const check = (raw, index) => {
    const words = raw.trim().match(/[A-Za-z؀-ۿ]{2,}/g) ?? []
    if (words.length && words.some((w) => !ALLOWED.has(w)) && LETTERS.test(raw)) {
      hits.push(`${relative(ROOT, file)}:${lineOf(index)}  ${raw.trim().slice(0, 60)}`)
    }
  }
  for (const m of src.matchAll(TEXT)) {
    // Skip TS generics/comparisons that look like tags (e.g. `a > b && c < d`).
    if (/[=&|?;()]/.test(m[1]) || /^\s*(return|const|let|await|Promise|Record)\b/.test(m[1])) continue
    check(m[1], m.index)
  }
  for (const m of src.matchAll(ATTR)) check(m[2], m.index)
}

// Every key must exist in both languages.
const flat = (o, pre = '') =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${pre}${k}.`) : [`${pre}${k}`]))
const load = (lng) => new Set(flat(JSON.parse(readFileSync(join(ROOT, `locales/${lng}.json`), 'utf8'))))
const en = load('en')
const ur = load('ur')
for (const k of en) if (!ur.has(k)) hits.push(`locales/ur.json  missing key ${k}`)
for (const k of ur) if (!en.has(k)) hits.push(`locales/en.json  missing key ${k}`)

if (hits.length) {
  console.error(`Hard-coded UI text (move to locales/en.json + ur.json):\n${hits.join('\n')}`)
  process.exit(1)
}
console.log(`i18n check: ${files.length} files, no hard-coded text; ${en.size} keys in en and ur`)
