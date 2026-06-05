// Generates placeholder macOS menu-bar template icons (a soft filled disc) with
// no external image deps. Files ending in "Template" are auto-treated as template
// images by Electron, so only the alpha channel matters; color stays black.
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(here, '..', 'assets', 'icons')
mkdirSync(iconsDir, { recursive: true })

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function makePng(size, outPath) {
  const r = size / 2
  const c = (size - 1) / 2
  const edge = r - 1.2
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter byte: none
    for (let x = 0; x < size; x++) {
      const dist = Math.hypot(x - c, y - c)
      let a = 0
      if (dist <= edge) a = 255
      else if (dist <= r) a = Math.round((255 * (r - dist)) / (r - edge))
      const off = y * (stride + 1) + 1 + x * 4
      raw[off] = 0
      raw[off + 1] = 0
      raw[off + 2] = 0
      raw[off + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(outPath, png)
  return png.length
}

const a = makePng(22, join(iconsDir, 'trayTemplate.png'))
const b = makePng(44, join(iconsDir, 'trayTemplate@2x.png'))
console.log(`wrote trayTemplate.png (${a} bytes), trayTemplate@2x.png (${b} bytes)`)
