/**
 * Converts an E57 point cloud into a GLB triangle mesh, entirely in the browser.
 *
 * It reuses the viewer's WebAssembly module: `E57Handle.stream` decodes the scan into octree
 * leaves (14-byte records quantised to each leaf cube), and `MeshBuilder` splats those leaves
 * into a sparse signed-distance field and extracts a vertex-coloured surface. The surface is
 * then written as glTF 2.0 binary, which three.js (and every other 3D tool) loads directly.
 *
 * Frame: vertices stay in the scan's local, Z-up frame (float32-safe). The root node rotates
 * Z-up to glTF's Y-up so a stock GLTFLoader shows it upright, and the scan's global shift is
 * kept in `asset.extras.shiphappens.translation` rather than baked in, so survey coordinates
 * don't lose millimetres to float32.
 */
import init, { E57Handle, MeshBuilder, set_window_size } from '@/packages/viewer/src/wasm/e57_wasm.js'
import wasmUrl from '@/packages/viewer/src/wasm/e57_wasm_bg.wasm?url'
import { convertE57, type ConvertOptions, type ConvertStats } from './e57ToGlbCore.ts'

export type { ConvertStats }

declare const FileReaderSync: { new (): { readAsArrayBuffer(blob: Blob): ArrayBuffer } }

export interface ConvertRequest extends ConvertOptions {
  type: 'convert'
  file: File
}

export type ConvertMessage =
  | { type: 'progress'; fraction: number; message: string }
  | { type: 'done'; glb: ArrayBuffer; stats: ConvertStats }
  | { type: 'error'; message: string }

const ctx = self as unknown as {
  postMessage(message: ConvertMessage, transfer?: Transferable[]): void
  onmessage: ((ev: MessageEvent<ConvertRequest>) => void) | null
}

let wasmReady: Promise<unknown> | null = null

ctx.onmessage = async (ev) => {
  if (ev.data?.type !== 'convert') {
    return
  }

  try {
    wasmReady ??= init({ module_or_path: wasmUrl })
    await wasmReady
    const file = ev.data.file
    const reader = new FileReaderSync()
    const { glb, stats } = convertE57(
      { E57Handle, MeshBuilder, set_window_size },
      {
        name: file.name,
        size: file.size,
        readRange: (offset, length) => {
          const end = Math.min(offset + length, file.size)

          return end <= offset ? new Uint8Array(0) : new Uint8Array(reader.readAsArrayBuffer(file.slice(offset, end)))
        },
      },
      ev.data,
      (fraction, message) =>
        ctx.postMessage({ type: 'progress', fraction: Math.max(0, Math.min(1, fraction)), message }),
    )
    ctx.postMessage({ type: 'done', glb, stats }, [glb])
  } catch (e) {
    ctx.postMessage({ type: 'error', message: String((e as Error)?.message ?? e) })
  }
}
