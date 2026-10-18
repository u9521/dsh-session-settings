#!/usr/bin/env node
/**
 * One-shot migration: the two hand-written config files -> storage-domain units.
 *
 * This is NOT part of the plugin and nothing loads it at runtime. The plugin
 * only reads the new format, so an operator runs this once against a stopped
 * host, then starts the host.
 *
 *   node scripts/migrate-storages.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const dryRun = process.argv.includes('--dry-run')
const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const root = path.join(home, 'storages')

const sessionPath = path.join(root, 'session_settings.json')
const mcpPath = path.join(root, 'mcp_servers.json')

function readJson(file) {
  if (!fs.existsSync(file)) return undefined
  const text = fs.readFileSync(file, 'utf8')
  if (!text.trim()) return undefined
  return JSON.parse(text)
}

function writeUnit(file, document) {
  if (dryRun) {
    console.log('[dry-run] would write', file)
    console.log(JSON.stringify(document, null, 2).slice(0, 400), '...')
    return
  }
  const tmp = `${file}.migrating`
  fs.writeFileSync(tmp, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  fs.renameSync(tmp, file)
  console.log('wrote', file)
}

// --- session_settings -------------------------------------------------------
const settings = readJson(sessionPath)
if (settings && settings.unit) {
  console.log('session_settings.json already migrated; skipping')
} else if (settings) {
  const document = {
    unit: { name: 'session_settings', version: 1 },
    global: settings.globalConfig ?? {},
    tables: {
      sessions: settings.sessions ?? {},
      workspaces: settings.workspaces ?? {},
    },
  }
  writeUnit(sessionPath, document)
} else {
  console.log('no session_settings.json; the domain starts empty')
}

// --- mcp_servers ------------------------------------------------------------
const mcp = readJson(mcpPath)
if (mcp && mcp.unit) {
  console.log('mcp_servers.json already migrated; skipping')
} else if (mcp) {
  // Normalize the transport spelling while migrating. Older entries stored
  // `streamable-http-or-sse` or `sse`; the domain schema accepts the two
  // canonical values only, so the conversion belongs to this one-shot script
  // rather than to a compatibility branch in the plugin.
  const servers = {}
  let normalized = 0
  for (const [id, server] of Object.entries(mcp.servers ?? {})) {
    if (
      server.transport === 'streamable-http-or-sse' ||
      server.transport === 'sse'
    ) {
      servers[id] = { ...server, transport: 'streamable-http' }
      normalized++
    } else {
      servers[id] = server
    }
  }
  if (normalized > 0) {
    console.log(`normalized ${normalized} legacy transport spelling(s)`)
  }
  const document = {
    unit: { name: 'mcp_servers', version: 1 },
    global: null,
    tables: { servers },
  }
  writeUnit(mcpPath, document)
} else {
  console.log('no mcp_servers.json; the domain starts empty')
}

if (!dryRun) {
  console.log(
    '\nBack up the originals first if you have not: they were overwritten.',
  )
}
