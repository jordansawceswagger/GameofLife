import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEntityLinks, getEntitiesForContact } from '../../src/main/crm/entity-links'

const here = path.dirname(fileURLToPath(import.meta.url))
const ENTITY_FIXTURES = path.resolve(here, '..', 'fixtures', 'entities')
const prevVault = process.env.GOL_VAULT_ROOT

let vaultRoot = ''

afterEach(async () => {
  if (prevVault === undefined) delete process.env.GOL_VAULT_ROOT
  else process.env.GOL_VAULT_ROOT = prevVault
  if (vaultRoot) await rm(vaultRoot, { recursive: true, force: true })
  vaultRoot = ''
})

describe('entity-links reverse map', () => {
  it('maps each contact id to the entity slugs that reference it', async () => {
    vaultRoot = await mkdtemp(path.join(tmpdir(), 'gol-vault-'))
    const entitiesDir = path.join(vaultRoot, '20_Delilah', 'Entities')
    await mkdir(entitiesDir, { recursive: true })
    await cp(ENTITY_FIXTURES, entitiesDir, { recursive: true })
    process.env.GOL_VAULT_ROOT = vaultRoot

    await buildEntityLinks()

    expect(getEntitiesForContact('t_seed_pc_1').sort()).toEqual([
      'test-entity-alpha',
      'test-entity-beta',
    ])
    expect(getEntitiesForContact('t_seed_mala_1')).toEqual(['test-entity-alpha'])
    // gamma has an empty crm_contact_ids array
    expect(getEntitiesForContact('t_seed_edge_1')).toEqual([])
    expect(getEntitiesForContact('nonexistent')).toEqual([])
  })

  it('returns empty when the Entities folder is missing', async () => {
    vaultRoot = await mkdtemp(path.join(tmpdir(), 'gol-vault-empty-'))
    process.env.GOL_VAULT_ROOT = vaultRoot
    await buildEntityLinks()
    expect(getEntitiesForContact('t_seed_pc_1')).toEqual([])
  })
})
