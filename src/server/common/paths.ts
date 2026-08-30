import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

function getStorageDir(): string {
  const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const storageDir = path.join(dshHome, 'storages')
  try {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true })
    }
  } catch {}
  return storageDir
}

export function getMcpStoragePath(): string {
  return path.join(getStorageDir(), 'mcp_servers.json')
}

export function getSessionSettingsStoragePath(): string {
  return path.join(getStorageDir(), 'session_settings.json')
}
