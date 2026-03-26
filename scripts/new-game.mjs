#!/usr/bin/env node
/**
 * new-game.mjs — scaffold a new minigame from templates
 *
 * Usage:  npm run new-game -- <id> [ComponentName]
 *   id            lowercase alphanumeric, no spaces  (e.g. wordrace)
 *   ComponentName PascalCase display name            (e.g. WordRace)
 *                 Defaults to id with first letter capitalised if omitted.
 *
 * Creates / modifies these files (skips file creation if dest already exists):
 *   server/src/minigames/<id>.ts                          — server module
 *   client/src/minigames/<ComponentName>.tsx              — client component
 *   client/src/minigames/<ComponentName>.spectator.tsx    — spectator view
 *   shared/types.ts                                       — state interface + MinigameStateMap entry
 *   client/src/__tests__/minigames/minigames.test.tsx     — smoke test block
 *
 * Then prints the remaining manual steps from ADDING_A_GAME.md.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const [, , id, rawName] = process.argv

// ── Validate args ──────────────────────────────────────────────────────────────

if (!id) {
  console.error('Usage: npm run new-game -- <id> [ComponentName]')
  console.error('  id            lowercase alphanumeric, e.g. wordrace')
  console.error('  ComponentName PascalCase, e.g. WordRace  (defaults to capitalised id)')
  process.exit(1)
}

if (!/^[a-z][a-z0-9]*$/.test(id)) {
  console.error(`Error: id must be lowercase alphanumeric starting with a letter — got '${id}'`)
  console.error('       Example valid ids: wordrace, colorblast, numberjump')
  process.exit(1)
}

const name = rawName ?? id.charAt(0).toUpperCase() + id.slice(1)

if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
  console.error(`Error: ComponentName must start with an uppercase letter — got '${name}'`)
  process.exit(1)
}

// ── File specs ─────────────────────────────────────────────────────────────────

const files = [
  {
    src: 'server/src/minigames/_template.ts',
    dest: `server/src/minigames/${id}.ts`,
    transform(src) {
      return src
        .replaceAll("'yourgameid'", `'${id}'`)
        .replace('const template:', `const ${id}:`)
        .replace('export default template', `export default ${id}`)
    },
  },
  {
    src: 'client/src/minigames/_Template.tsx',
    dest: `client/src/minigames/${name}.tsx`,
    transform(src) {
      return src
        .replaceAll("'yourgameid'", `'${id}'`)
        .replace('export default function Template()', `export default function ${name}()`)
        // Activate the shared type import
        .replace(
          "// import { type YourGameState } from '@shared/types'",
          `import { type ${name}State } from '@shared/types'`,
        )
        // Remove the now-unnecessary local empty interface
        .replace(
          "\n// eslint-disable-next-line @typescript-eslint/no-empty-object-type\ninterface ServerState {\n  // TODO: match the server module's State fields\n  // example: score: Record<string, number>\n}\n",
          '\n',
        )
        // Use the shared type in the cast
        .replace('(minigameState as ServerState)', `(minigameState as ${name}State)`)
    },
  },
  {
    src: 'client/src/minigames/_Template.spectator.tsx',
    dest: `client/src/minigames/${name}.spectator.tsx`,
    transform(src) {
      return src
        .replaceAll("'yourgameid'", `'${id}'`)
        .replace(
          'export default function TemplateSpectator(',
          `export default function ${name}Spectator(`,
        )
    },
  },
]

// ── Copy files ─────────────────────────────────────────────────────────────────

let anySkipped = false

for (const { src, dest, transform } of files) {
  const srcPath = resolve(root, src)
  const destPath = resolve(root, dest)

  if (existsSync(destPath)) {
    console.warn(`⚠  Skipping ${dest} — file already exists`)
    anySkipped = true
    continue
  }

  writeFileSync(destPath, transform(readFileSync(srcPath, 'utf8')))
  console.log(`✅ Created ${dest}`)
}

if (anySkipped) {
  console.log()
  console.log('Some files were skipped. Remove them first if you want to regenerate.')
}

// ── Patch shared/types.ts ──────────────────────────────────────────────────────

const typesPath = resolve(root, 'shared/types.ts')
let types = readFileSync(typesPath, 'utf8')

const stateInterface = `\nexport interface ${name}State {\n  kind: '${id}'\n  // TODO: add state fields\n}\n`
const mapEntry = `  ${id}: ${name}State\n`

if (types.includes(`interface ${name}State`)) {
  console.warn(`⚠  Skipping shared/types.ts state interface — ${name}State already exists`)
} else {
  // Insert state interface just before MinigameStateMap
  types = types.replace('\nexport type MinigameStateMap = {', stateInterface + '\nexport type MinigameStateMap = {')
  // Insert entry into the map body (before the closing })
  types = types.replace(/(export type MinigameStateMap = \{[^}]+)(\})/, (_, body, close) => `${body}${mapEntry}${close}`)
  writeFileSync(typesPath, types)
  console.log(`✅ Patched shared/types.ts  (${name}State + MinigameStateMap entry)`)
}

// ── Append smoke test ──────────────────────────────────────────────────────────

const testPath = resolve(root, 'client/src/__tests__/minigames/minigames.test.tsx')
let testSrc = readFileSync(testPath, 'utf8')

const describeMarker = `describe('${name}',`

if (testSrc.includes(describeMarker)) {
  console.warn(`⚠  Skipping minigames.test.tsx — describe('${name}', ...) already exists`)
} else {
  const sep = '─'.repeat(Math.max(0, 78 - name.length - 5))
  const block = `
// ── ${name} ${sep}

describe('${name}', () => {
  it('renders without crashing', async () => {
    await renderGame('${name}')
    expect(document.body).toBeTruthy()
  })

  it('renders live state from server', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: { kind: '${id}' },
    })
    await renderGame('${name}')
    expect(document.body).toBeTruthy()
  })
})
`
  writeFileSync(testPath, testSrc.trimEnd() + '\n' + block)
  console.log(`✅ Appended smoke test to minigames.test.tsx`)
}

// ── Next steps ─────────────────────────────────────────────────────────────────

console.log()
console.log(`🎮 Next steps for '${id}' (see ADDING_A_GAME.md for the full walkthrough):`)
console.log()
console.log(`  1. shared/types.ts`)
console.log(`       → Add '${id}' entry to MINIGAME_CONFIGS (label, emoji, timeoutMs, category, description, platforms)`)
console.log(`       → Fill in ${name}State fields  (interface already inserted)`)
console.log()
console.log(`  2. server/src/minigames/${id}.ts`)
console.log(`       → Fill in State fields, start(), handleInput(), getResult()`)
console.log()
console.log(`  3. client/src/minigames/${name}.tsx`)
console.log(`       → Build live + mock game UI; ${name}State is already imported`)
console.log()
console.log(`  4. client/src/minigames/${name}.spectator.tsx`)
console.log(`       → Wire up TwoColState or a custom spectator layout`)
console.log()
console.log(`  5. client/src/utils/sounds.ts  → AMBIENT map`)
console.log(`       → Add ambient sound layers for '${id}'`)
console.log()
console.log(`  6. server/src/__tests__/minigames/${id}.test.ts`)
console.log(`       → Unit + integration tests  (makeRoom + makeMatch helpers)`)
console.log()
console.log(`  7. tests/e2e/helpers/gameInputs.ts  → STRATEGIES map`)
console.log(`       → Add bot strategy for E2E test`)
console.log()
console.log(`  ✔  cd client && npx tsc --noEmit`)
console.log(`  ✔  cd server && npx tsc --noEmit`)
