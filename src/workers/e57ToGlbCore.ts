/**
 * The E57 -> GLB pipeline, independent of how the WASM module is loaded and how bytes are read,
 * so the worker can run it on a File and tests can run it in Node.
 */
import type { E57Handle as E57HandleT, MeshBuilder as MeshBuilderT } from '@/packages/viewer/src/wasm/e57_wasm.js'
import { encodeGlb } from './glbEncoder.ts'

export interface WasmApi {
  E57Handle: typeof E57HandleT
  MeshBuilder: typeof MeshBuilderT
  set_window_size: (n: number) => void
}

export interface ConvertSource {
  name: string
  size: number
  readRange: (offset: number, length: number) => Uint8Array
}

export interface ConvertOptions {
  /** Points fed to the mesher; more than this only slows it down without changing the surface. */
  maxPoints?: number
  /** Rough vertex budget for the model, which sets the voxel size and so the file size. */
  targetVertices?: number
}

export interface ConvertStats {
  vertices: number
  triangles: number
  voxelCm: number
  sourcePoints: number
  usedPoints: number
  ms: number
}

/** sd + weight + rgb per voxel, 8^3 voxels per brick (matches the mesher). */
const BRICK_BYTES = 8 * 8 * 8 * 7
const FIELD_BUDGET = 900e6
const TRUNC_VOXELS = 2
const MIN_WEIGHT = 0.15
const SMOOTH = 2

interface LeafRecs {
  origin: [number, number, number]
  size: number
  recs: Uint8Array
  count: number
  spacing: number
}

export function convertE57(
  api: WasmApi,
  src: ConvertSource,
  opts: ConvertOptions,
  progress: (fraction: number, message: string) => void,
): { glb: ArrayBuffer; stats: ConvertStats } {
  const { E57Handle, MeshBuilder, set_window_size } = api
  const t0 = performance.now()
  const readRange = src.readRange
  const file = { name: src.name, size: src.size }
  const req = opts

  progress(0.01, 'Reading scan header…')
  set_window_size(256 * 1024)
  const handle = new E57Handle(readRange, file.size)
  const meta = JSON.parse(handle.meta()) as {
    scans: { points: number; translation?: number[]; name?: string }[]
  }
  const scan = meta.scans[0]

  if (!scan) {
    throw new Error('This E57 file contains no point clouds')
  }

  const maxPoints = req.maxPoints ?? 14e6
  const stride = Math.max(1, Math.ceil(scan.points / maxPoints))
  set_window_size(32 * 1024 * 1024)

  // ---- 1. decode into octree leaves (0 → 60 %)
  const leaves: LeafRecs[] = []
  let usedPoints = 0
  handle.stream(
    0,
    stride,
    200_000,
    1.5e9,
    () => {
      // preview batches are for the live viewer; nothing to show here
    },
    (phase: number, done: number, total: number) => {
      const f = total > 0 ? done / total : 0
      progress(phase === 0 ? f * 0.5 : 0.5 + f * 0.1, phase === 0 ? 'Decoding points…' : 'Organising points…')

      return false
    },
    (blocks: Uint8Array[], count: number, m: Float64Array) => {
      let bytes = 0

      for (const b of blocks) {
        bytes += b.byteLength
      }

      const n = Math.min(count, Math.floor(bytes / 14))
      const recs = new Uint8Array(n * 14)
      let o = 0

      for (const b of blocks) {
        const take = Math.min(b.byteLength, recs.length - o)
        recs.set(b.subarray(0, take), o)
        o += take
      }

      // typical spacing on the surfaces in this cell (same estimate the viewer uses)
      const dx = m[7] - m[4]
      const dy = m[8] - m[5]
      const dz = m[9] - m[6]
      const area = 2 * (dx * dy + dy * dz + dx * dz)
      const spacing = Math.min(Math.max(Math.sqrt(Math.max(area, 1e-4) / Math.max(n, 1)), 1e-4), m[3] * 0.5)
      leaves.push({ origin: [m[0], m[1], m[2]], size: m[3], recs, count: n, spacing })
      usedPoints += n
    },
  )
  handle.free()

  if (!leaves.length) {
    throw new Error('No points were decoded from this scan')
  }

  // ---- 2. pick a voxel: twice the point spacing, coarsened to stay within the vertex budget
  const dense = leaves.filter((l) => l.count > 64).map((l) => l.spacing).sort((a, b) => a - b)
  const spacing = dense.length ? dense[dense.length >> 1] : 0.05
  let surfaceArea = 0

  for (const l of leaves) {
    surfaceArea += l.count * l.spacing * l.spacing
  }

  const targetVertices = req.targetVertices ?? 1_500_000
  let voxel = Math.max(2 * spacing, Math.sqrt(surfaceArea / targetVertices))
  voxel = Math.min(0.6, Math.max(0.01, voxel))

  // ---- 3. build the field, coarsening if it outgrows memory (60 → 90 %)
  const identity = new Float32Array(0)
  let mesh: { pos: Float32Array; nrm: Float32Array; col: Uint8Array; idx: Uint32Array } | null = null

  for (let attempt = 0; attempt < 5 && !mesh; attempt++) {
    const builder = new MeshBuilder(voxel, TRUNC_VOXELS, MIN_WEIGHT)
    let overBudget = false

    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i]
      builder.add_leaf(l.origin[0], l.origin[1], l.origin[2], l.size, l.recs, 1, identity)

      if ((i & 15) === 15) {
        if (builder.bricks() * BRICK_BYTES > FIELD_BUDGET) {
          overBudget = true
          break
        }

        progress(0.6 + (i / leaves.length) * 0.25, `Building surface at ${(voxel * 100).toFixed(1)} cm…`)
      }
    }

    if (overBudget) {
      builder.free()
      voxel *= 1.5
      continue
    }

    progress(0.86, 'Extracting the surface…')
    builder.build(SMOOTH, 1.0)
    mesh = { pos: builder.positions(), nrm: builder.normals(), col: builder.colors(), idx: builder.indices() }
    builder.free()
  }

  if (!mesh) {
    throw new Error('The scan is too large to mesh in this browser')
  }

  if (!mesh.idx.length) {
    throw new Error('No surface could be reconstructed from this scan')
  }

  // ---- 4. encode (90 → 100 %)
  progress(0.92, 'Writing GLB…')
  const translation = (scan.translation ?? [0, 0, 0]).slice(0, 3)
  const glb = encodeGlb(mesh, {
    name: scan.name || file.name.replace(/\.[^.]+$/, ''),
    translation,
    voxelCm: +(voxel * 100).toFixed(2),
    sourcePoints: scan.points,
    usedPoints,
    sourceFile: file.name,
  })
  progress(1, 'Model ready')

  return {
    glb,
    stats: {
      vertices: mesh.pos.length / 3,
      triangles: mesh.idx.length / 3,
      voxelCm: +(voxel * 100).toFixed(2),
      sourcePoints: scan.points,
      usedPoints,
      ms: performance.now() - t0,
    },
  }
}
