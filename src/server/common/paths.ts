import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

function getStorageDir(ensureExists = false): string {
  const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const storageDir = path.join(dshHome, 'storages')
  if (ensureExists) {
    try {
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true })
      }
    } catch {}
  }
  return storageDir
}

export function getMcpStoragePath(ensureDir = false): string {
  return path.join(getStorageDir(ensureDir), 'mcp_servers.json')
}

export function getSessionSettingsStoragePath(ensureDir = false): string {
  return path.join(getStorageDir(ensureDir), 'session_settings.json')
}
