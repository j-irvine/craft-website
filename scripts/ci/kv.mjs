// CI: finds the Worker's KV namespace (creating it the first time) and writes its id into wrangler.jsonc.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const TITLE = 'craft-website-data'
const wrangler = (...args) => execFileSync('npx', ['--yes', 'wrangler@4', ...args], { encoding: 'utf8' })

const list = () => JSON.parse(wrangler('kv', 'namespace', 'list'))
let ns = list().find((n) => n.title === TITLE)
if (!ns) {
  wrangler('kv', 'namespace', 'create', TITLE)
  ns = list().find((n) => n.title === TITLE)
}
if (!ns) throw new Error(`Couldn't find or create the KV namespace ${TITLE}`)
const config = readFileSync('wrangler.jsonc', 'utf8')
writeFileSync('wrangler.jsonc', config.replace('REPLACE_WITH_KV_ID', ns.id))
console.log(`KV namespace ${TITLE}: ${ns.id}`)
