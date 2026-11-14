import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { Button, HTMLSelect, Intent, Spinner } from '@blueprintjs/core'

type ColorMode = 'range' | 'intensity' | 'normals' | 'rgb'

function turboColor(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t))
  const r = Math.max(0, Math.min(255, Math.round(255 * (0.135 + x * (4.61 - x * (13.3 - x * (14.4 - 5.2 * x)))))))
  const g = Math.max(0, Math.min(255, Math.round(255 * (0.091 + x * (2.26 + x * (1.28 - x * (5.9 - 2.3 * x)))))))
  const b = Math.max(0, Math.min(255, Math.round(255 * (0.106 + x * (3.34 - x * (12.1 - x * (13.4 - 4.7 * x)))))))
  return [r, g, b]
}

export default function UnwrappedScanOverlay({
  inspectorEl,
}: {
  inspectorEl: HTMLDivElement | null
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [colorBy, setColorBy] = useState<ColorMode>('range')
  const [stationIndex, setStationIndex] = useState(0)
  const [stationCount, setStationCount] = useState(0)
  const [fillGaps, setFillGaps] = useState(true)
  const [isRendering, setIsRendering] = useState(false)
  const [info, setInfo] = useState('—')

  const renderUnwrapped = useCallback(async () => {
    const canvas = canvasRef.current
    const viewer = (window as unknown as { __viewer?: any }).__viewer
    const cells = viewer?.active?.cells
    if (!canvas || !cells || !cells.leaves?.length) {
      setInfo('No scan loaded')
      return
    }

    setIsRendering(true)
    await new Promise((r) => setTimeout(r, 15))

    const stations: Array<{ t: number[] }> = viewer.stations ?? []
    setStationCount(stations.length)
    const box = viewer.measuredBox?.(viewer.active)
    const center = new THREE.Vector3()
    if (stations.length > 0 && viewer.stationPositions) {
      const posList: number[][] = viewer.stationPositions()
      const chosen = posList[Math.min(stationIndex, posList.length - 1)]
      if (chosen) center.set(chosen[0], chosen[1], chosen[2])
    } else if (box && !box.isEmpty()) {
      box.getCenter(center)
    }

    const W = 1536
    const H = 768
    canvas.width = W
    canvas.height = H

    const zBuf = new Float32Array(W * H)
    zBuf.fill(Infinity)
    const imgData = new ImageData(W, H)
    const data = imgData.data
    // Dark background
    for (let i = 0; i < W * H; i++) {
      data[i * 4] = 17
      data[i * 4 + 1] = 17
      data[i * 4 + 2] = 17
      data[i * 4 + 3] = 255
    }

    const leaves = cells.leaves.filter((l: any) => !l.preview && l.count > 0)
    const gl = cells.gl2
    const model = cells.model as THREE.Matrix4
    const maxPerLeaf = Math.max(...leaves.map((l: any) => l.count), 1)
    const tmp = new Float64Array(maxPerLeaf * 3)
    const v = new THREE.Vector3()

    // Estimate max range from bounding box diagonal for range color ramp
    const maxRange = box && !box.isEmpty() ? Math.max(1, box.getSize(new THREE.Vector3()).length() * 0.65) : 30

    let plotted = 0
    for (const leaf of leaves) {
      const recs: Uint8Array = leaf.readback(gl)
      cells.transformRecordsInto(recs, leaf.count, leaf, tmp)

      for (let i = 0; i < leaf.count; i++) {
        v.set(tmp[i * 3], tmp[i * 3 + 1], tmp[i * 3 + 2]).applyMatrix4(model)
        const dx = v.x - center.x
        const dy = v.y - center.y
        const dz = v.z - center.z
        const dist = Math.hypot(dx, dy, dz)
        if (dist < 0.05) continue

        const az = Math.atan2(dy, dx)
        const el = Math.asin(Math.max(-1, Math.min(1, dz / dist)))
        let u = 0.5 - az / (Math.PI * 2)
        if (u < 0) u += 1
        if (u >= 1) u -= 1
        const vv = 0.5 - el / Math.PI

        const px = Math.max(0, Math.min(W - 1, Math.floor(u * W)))
        const py = Math.max(0, Math.min(H - 1, Math.floor(vv * H)))
        const pIdx = py * W + px

        if (dist < zBuf[pIdx]) {
          zBuf[pIdx] = dist
          const off = i * 14
          let r = 200, g = 200, b = 200
          if (colorBy === 'range') {
            ;[r, g, b] = turboColor(dist / maxRange)
          } else if (colorBy === 'intensity') {
            const inten = recs[off + 9]
            r = inten
            g = inten
            b = inten
          } else if (colorBy === 'normals') {
            const nx = (recs[off + 10] << 24) >> 24
            const ny = (recs[off + 11] << 24) >> 24
            const nz = (recs[off + 12] << 24) >> 24
            r = Math.max(0, Math.min(255, nx + 128))
            g = Math.max(0, Math.min(255, ny + 128))
            b = Math.max(0, Math.min(255, nz + 128))
          } else {
            r = recs[off + 6]
            g = recs[off + 7]
            b = recs[off + 8]
          }
          const dOff = pIdx * 4
          data[dOff] = r
          data[dOff + 1] = g
          data[dOff + 2] = b
          plotted++
        }
      }
    }

    if (fillGaps) {
      const copy = new Uint8ClampedArray(data)
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const pIdx = y * W + x
          if (zBuf[pIdx] < Infinity) continue
          // Pull nearest valid neighbor within 1px
          const neighbors = [pIdx - 1, pIdx + 1, pIdx - W, pIdx + W]
          let bestD = Infinity
          let bestN = -1
          for (const n of neighbors) {
            if (zBuf[n] < bestD) {
              bestD = zBuf[n]
              bestN = n
            }
          }
          if (bestN >= 0) {
            const dst = pIdx * 4
            const src = bestN * 4
            data[dst] = copy[src]
            data[dst + 1] = copy[src + 1]
            data[dst + 2] = copy[src + 2]
          }
        }
      }
    }

    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imgData, 0, 0)
    setInfo(`${W}×${H} unwrapped · ${plotted.toLocaleString()} pixels`)
    setIsRendering(false)
  }, [colorBy, stationIndex, fillGaps])

  useEffect(() => {
    void renderUnwrapped()
  }, [renderUnwrapped])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `unwrapped-${colorBy}.png`
    a.click()
  }

  const inspectorControls = (
    <div className="p-3 border-b border-[#2a2a2a] text-xs text-white space-y-2.5">
      <div className="font-semibold text-gray-200">
        Depth / Range / Intensity (2D Unwrapped)
      </div>

      <label className="flex items-center justify-between gap-2">
        <span className="text-gray-300">Channel</span>
        <HTMLSelect
          value={colorBy}
          onChange={(e) => setColorBy(e.target.value as ColorMode)}
        >
          <option value="range">Range (Depth)</option>
          <option value="intensity">Laser Intensity</option>
          <option value="normals">Surface Normals</option>
          <option value="rgb">RGB Color</option>
        </HTMLSelect>
      </label>

      {stationCount > 1 && (
        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-300">Station</span>
          <HTMLSelect
            value={stationIndex}
            onChange={(e) => setStationIndex(Number(e.target.value))}
          >
            {Array.from({ length: stationCount }, (_, i) => (
              <option key={i} value={i}>
                Station {i + 1}
              </option>
            ))}
          </HTMLSelect>
        </label>
      )}

      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="text-gray-300">Fill 1px gaps</span>
        <input
          type="checkbox"
          checked={fillGaps}
          onChange={(e) => setFillGaps(e.target.checked)}
        />
      </label>

      <Button
        fill
        small
        intent={Intent.PRIMARY}
        icon="download"
        onClick={handleDownload}
      >
        Save unwrapped PNG…
      </Button>

      <p className="text-[11px] text-gray-400">{info}</p>
    </div>
  )

  return (
    <div className="absolute inset-0 z-[9] bg-[#111111] flex flex-col items-center justify-center p-4">
      <div className="relative w-full h-full flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain rounded-lg border border-[#2a2a2a] shadow-2xl"
        />
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="flex items-center gap-2 bg-[#1e1e1e] border border-[#333333] px-4 py-2 rounded-lg text-xs text-white">
              <Spinner size={16} />
              <span>Unwrapping 2D scan…</span>
            </div>
          </div>
        )}
      </div>

      {inspectorEl && createPortal(inspectorControls, inspectorEl)}
    </div>
  )
}
