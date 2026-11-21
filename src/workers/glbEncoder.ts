/** Writes a vertex-coloured triangle mesh as glTF 2.0 binary (GLB). No dependencies, so it is testable in Node. */

// ------------------------------------------------------------------------------------- GLB

export interface GlbMeta {
  name: string
  translation: number[]
  voxelCm: number
  sourcePoints: number
  usedPoints: number
  sourceFile: string
}

/** sRGB byte → linear 16-bit: glTF vertex colours are linear, scan colours are sRGB. */
const SRGB_TO_LINEAR16 = (() => {
  const lut = new Uint16Array(256)

  for (let i = 0; i < 256; i++) {
    const c = i / 255
    const lin = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    lut[i] = Math.round(lin * 65535)
  }

  return lut
})()

export function encodeGlb(
  m: { pos: Float32Array; nrm: Float32Array; col: Uint8Array; idx: Uint32Array },
  meta: GlbMeta,
): ArrayBuffer {
  const nv = m.pos.length / 3
  const ni = m.idx.length

  // unit normals (the spec requires them); degenerate ones point up
  const nrm = new Float32Array(nv * 3)

  for (let i = 0; i < nv; i++) {
    const x = m.nrm[i * 3]
    const y = m.nrm[i * 3 + 1]
    const z = m.nrm[i * 3 + 2]
    const len = Math.hypot(x, y, z)

    if (len > 1e-8) {
      nrm[i * 3] = x / len
      nrm[i * 3 + 1] = y / len
      nrm[i * 3 + 2] = z / len
    } else {
      nrm[i * 3 + 2] = 1
    }
  }

  const col = new Uint16Array(nv * 4)
  const hasCol = m.col.length >= nv * 3

  for (let i = 0; i < nv; i++) {
    col[i * 4] = SRGB_TO_LINEAR16[hasCol ? m.col[i * 3] : 200]
    col[i * 4 + 1] = SRGB_TO_LINEAR16[hasCol ? m.col[i * 3 + 1] : 200]
    col[i * 4 + 2] = SRGB_TO_LINEAR16[hasCol ? m.col[i * 3 + 2] : 200]
    col[i * 4 + 3] = 65535
  }

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]

  for (let i = 0; i < nv; i++) {
    for (let a = 0; a < 3; a++) {
      const v = m.pos[i * 3 + a]

      if (v < min[a]) {
        min[a] = v
      }

      if (v > max[a]) {
        max[a] = v
      }
    }
  }

  // every section is a multiple of 4 bytes, so no padding between them
  const parts: ArrayBufferView[] = [m.pos, nrm, col, m.idx]
  const views = []
  let offset = 0

  for (let i = 0; i < parts.length; i++) {
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: parts[i].byteLength,
      target: i === 3 ? 34963 : 34962,
    })
    offset += parts[i].byteLength
  }

  const binLength = offset
  const gltf = {
    asset: {
      version: '2.0',
      generator: 'ShipHappens E57 to GLB',
      extras: {
        shiphappens: {
          translation: meta.translation,
          upAxis: 'Z',
          voxelCm: meta.voxelCm,
          sourcePoints: meta.sourcePoints,
          usedPoints: meta.usedPoints,
          sourceFile: meta.sourceFile,
        },
      },
    },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0,
    scenes: [{ name: meta.name, nodes: [0] }],
    // Z-up scan → Y-up glTF: -90° about X
    nodes: [{ name: meta.name, mesh: 0, rotation: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2] }],
    meshes: [
      {
        name: meta.name,
        primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, material: 0, mode: 4 }],
      },
    ],
    // Scan colours already contain the real lighting, so render them as captured.
    materials: [
      {
        name: 'scan',
        pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 },
        doubleSided: true,
        extensions: { KHR_materials_unlit: {} },
      },
    ],
    buffers: [{ byteLength: binLength }],
    bufferViews: views,
    accessors: [
      { bufferView: 0, componentType: 5126, count: nv, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: nv, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, normalized: true, count: nv, type: 'VEC4' },
      { bufferView: 3, componentType: 5125, count: ni, type: 'SCALAR' },
    ],
  }

  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf))
  const jsonPadded = (jsonBytes.length + 3) & ~3
  const total = 12 + 8 + jsonPadded + 8 + binLength
  const out = new ArrayBuffer(total)
  const dv = new DataView(out)
  const u8 = new Uint8Array(out)

  dv.setUint32(0, 0x46546c67, true) // "glTF"
  dv.setUint32(4, 2, true)
  dv.setUint32(8, total, true)
  dv.setUint32(12, jsonPadded, true)
  dv.setUint32(16, 0x4e4f534a, true) // "JSON"
  u8.set(jsonBytes, 20)
  u8.fill(0x20, 20 + jsonBytes.length, 20 + jsonPadded)

  let o = 20 + jsonPadded
  dv.setUint32(o, binLength, true)
  dv.setUint32(o + 4, 0x004e4942, true) // "BIN\0"
  o += 8

  for (const p of parts) {
    u8.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), o)
    o += p.byteLength
  }

  return out
}
