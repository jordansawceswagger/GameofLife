import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { getVaultRoot } from '../vault'

// Reverse map contactId -> entity slug[], built in memory at launch and on demand
// from the Delilah entity tracker frontmatter. Never persisted to crm.json.

export function entitiesDir(): string {
  return path.join(getVaultRoot(), '20_Delilah', 'Entities')
}

let reverseMap = new Map<string, string[]>()

export async function buildEntityLinks(): Promise<Map<string, string[]>> {
  const dir = entitiesDir()
  const map = new Map<string, string[]>()
  if (existsSync(dir)) {
    const files = (await readdir(dir)).filter((f) => f.endsWith('.md'))
    for (const file of files) {
      const slug = file.replace(/\.md$/, '')
      const data = matter(await readFile(path.join(dir, file), 'utf8')).data as {
        crm_contact_ids?: unknown
      }
      const raw = Array.isArray(data.crm_contact_ids) ? data.crm_contact_ids : []
      // Dedupe ids within a file so an id listed twice does not double-count the slug.
      const ids = new Set(raw.filter((id): id is string => typeof id === 'string'))
      for (const id of ids) {
        const list = map.get(id) ?? []
        list.push(slug)
        map.set(id, list)
      }
    }
  }
  reverseMap = map
  return map
}

export function getEntitiesForContact(id: string): string[] {
  return reverseMap.get(id) ?? []
}

/** Rebuild the in-memory map (call on launch and whenever entities change). */
export async function rebuildEntityLinks(): Promise<void> {
  await buildEntityLinks()
}
