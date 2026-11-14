import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'
import { Button, HTMLSelect, Intent, Spinner } from '@blueprintjs/core'

function buildSplatBufferFromViewer(maxSplats: number, splatRadius: number): {
  buffer: ArrayBuffer
  count: number
  center: [number, number, number]
} | null {
  const viewer = (window as unknown as { __viewer?: any }).__viewer
  const cells = viewer?.active?.cells
  if (!cells || !cells.leaves?.length) return null

  const leaves = cells.leaves.filter((l: any) => !l.preview && l.count > 0)
  if (!leaves.length) return null

  const totalPoints = leaves.reduce((s: number, l: any) => s + l.count, 0)
  if (!totalPoints) return null

  const targetCount = Math.min(maxSplats, totalPoints)
  const ratio = targetCount / totalPoints

  // First pass: determine exact sample count per leaf (leaves are already shuffled for uniform LOD)
  const counts: number[] = []
  let actualCount = 0
  for (const l of leaves) {
    const n = Math.max(1, Math.min(l.count, Math.round(l.count * ratio)))
    counts.push(n)
    actualCount += n
  }

  // Standard .splat binary format: 32 bytes per splat
  // [0..11] f32 x,y,z | [12..23] f32 sx,sy,sz | [24..27] u8 r,g,b,a | [28..31] u8 qw,qx,qy,qz
  const buffer = new ArrayBuffer(actualCount * 32)
  const f32 = new Float32Array(buffer)
  const u8 = new Uint8Array(buffer)

  const gl = cells.gl2
  const model = cells.model as THREE.Matrix4
  const tmp = new Float64Array(Math.max(...counts) * 3)
  const v = new THREE.Vector3()
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  let idx = 0

  for (let li = 0; li < leaves.length; li++) {
    const leaf = leaves[li]
    const n = counts[li]
    const recs: Uint8Array = leaf.readback(gl)
    cells.transformRecordsInto(recs, n, leaf, tmp)

    for (let i = 0; i < n; i++) {
      v.set(tmp[i * 3], tmp[i * 3 + 1], tmp[i * 3 + 2]).applyMatrix4(model)
      if (v.x < minX) minX = v.x
      if (v.y < minY) minY = v.y
      if (v.z < minZ) minZ = v.z
      if (v.x > maxX) maxX = v.x
      if (v.y > maxY) maxY = v.y
      if (v.z > maxZ) maxZ = v.z

      const fBase = idx * 8
      f32[fBase] = v.x
      f32[fBase + 1] = v.y
      f32[fBase + 2] = v.z
      f32[fBase + 3] = splatRadius
      f32[fBase + 4] = splatRadius
      f32[fBase + 5] = splatRadius

      const recOff = i * 14
      let r = recs[recOff + 6]
      let g = recs[recOff + 7]
      let b = recs[recOff + 8]
      const intensity = recs[recOff + 9]
      if (r === 0 && g === 0 && b === 0 && intensity > 0) {
        r = g = b = intensity
      }

      const bBase = idx * 32
      u8[bBase + 24] = r
      u8[bBase + 25] = g
      u8[bBase + 26] = b
      u8[bBase + 27] = 255
      u8[bBase + 28] = 255
      u8[bBase + 29] = 128
      u8[bBase + 30] = 128
      u8[bBase + 31] = 128

      idx++
    }
  }

  const center: [number, number, number] = [
    (minX + maxX) * 0.5,
    (minY + maxY) * 0.5,
    (minZ + maxZ) * 0.5,
  ]
  return { buffer, count: actualCount, center }
}

export default function GaussianSplatOverlay({
  isPanelOpen,
  onClosePanel,
}: {
  isPanelOpen: boolean
  onClosePanel: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const splatViewerRef = useRef<any>(null)
  const lastBlobUrlRef = useRef<string | null>(null)
  const lastBufferRef = useRef<ArrayBuffer | null>(null)

  const [maxSplats, setMaxSplats] = useState(150000)
  const [splatRadius, setSplatRadius] = useState(0.03)
  const [splatCount, setSplatCount] = useState(0)
  const [status, setStatus] = useState('Converting point cloud to 3D Gaussian Splats…')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disposeViewer = useCallback(() => {
    if (splatViewerRef.current) {
      try {
        splatViewerRef.current.dispose()
      } catch {
        // ignore dispose errors
      }
      splatViewerRef.current = null
    }
    if (lastBlobUrlRef.current) {
      URL.revokeObjectURL(lastBlobUrlRef.current)
      lastBlobUrlRef.current = null
    }
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
  }, [])

  const loadSplatUrl = useCallback(
    async (
      url: string,
      format: number,
      center: [number, number, number],
      countLabel: string,
    ) => {
      if (!containerRef.current) return
      disposeViewer()
      setIsLoading(true)
      setError(null)
      try {
        const viewer = new GaussianSplats3D.Viewer({
          rootElement: containerRef.current,
          cameraUp: [0, 0, 1],
          initialCameraPosition: [center[0] + 8, center[1] - 8, center[2] + 5],
          initialCameraLookAt: center,
          selfDrivenMode: true,
          useBuiltInControls: true,
          sharedMemoryForWorkers: false,
          gpuAcceleratedSort: false,
          integerBasedSort: false,
        })
        splatViewerRef.current = viewer
        await viewer.addSplatScene(url, {
          format,
          showLoadingUI: false,
        })
        viewer.start()
        setStatus(countLabel)
      } catch (err) {
        setError((err as Error)?.message || 'Failed to render Gaussian Splats')
        setStatus('Error rendering splats')
      } finally {
        setIsLoading(false)
      }
    },
    [disposeViewer],
  )

  const generateFromScan = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setStatus('Sampling scan points into Gaussian Splats…')
    await new Promise((r) => setTimeout(r, 20))
    const built = buildSplatBufferFromViewer(maxSplats, splatRadius)
    if (!built) {
      setIsLoading(false)
      setError('No loaded point cloud found. Open an .e57 scan first.')
      setStatus('No scan loaded')
      return
    }
    lastBufferRef.current = built.buffer
    setSplatCount(built.count)
    const blob = new Blob([built.buffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    lastBlobUrlRef.current = url
    await loadSplatUrl(
      url,
      GaussianSplats3D.SceneFormat.Splat,
      built.center,
      `${built.count.toLocaleString()} Gaussian splats (radius ${splatRadius} m)`,
    )
  }, [maxSplats, splatRadius, loadSplatUrl])

  useEffect(() => {
    void generateFromScan()
    return () => {
      disposeViewer()
    }
  }, [generateFromScan, disposeViewer])

  const handleLoadExternalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const lower = file.name.toLowerCase()
    const format = lower.endsWith('.ply')
      ? GaussianSplats3D.SceneFormat.Ply
      : lower.endsWith('.ksplat')
        ? GaussianSplats3D.SceneFormat.KSplat
        : GaussianSplats3D.SceneFormat.Splat
    const url = URL.createObjectURL(file)
    lastBufferRef.current = null
    await loadSplatUrl(url, format, [0, 0, 0], `Loaded ${file.name}`)
    lastBlobUrlRef.current = url
  }

  const handleDownloadSplat = () => {
    if (!lastBufferRef.current) return
    const blob = new Blob([lastBufferRef.current], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scan-${splatCount}.splat`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="absolute inset-0 top-12 z-[9] bg-[#111111]">
      <div ref={containerRef} className="w-full h-full" />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
          <div className="flex items-center gap-2.5 bg-[#1e1e1e] border border-[#333333] px-4 py-2.5 rounded-lg text-xs text-white shadow-xl">
            <Spinner size={16} />
            <span>{status}</span>
          </div>
        </div>
      )}

      {isPanelOpen && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-80 bg-[#1e1e1e]/95 backdrop-blur-md p-3 rounded-lg border border-[#333333] shadow-2xl text-xs text-white">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#333333]">
            <span className="font-semibold text-gray-200">
              3D Gaussian Splatting (.splat / .ply)
            </span>
            <Button small minimal icon="cross" onClick={onClosePanel} />
          </div>

          <div className="space-y-2.5">
            <label className="flex items-center justify-between gap-2">
              <span className="text-gray-300">Max splats</span>
              <HTMLSelect
                value={maxSplats}
                onChange={(e) => setMaxSplats(Number(e.target.value))}
              >
                <option value={50000}>50,000 (Fast)</option>
                <option value={150000}>150,000 (Balanced)</option>
                <option value={350000}>350,000 (Dense)</option>
              </HTMLSelect>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-gray-300">Splat radius</span>
              <input
                type="range"
                min="0.005"
                max="0.15"
                step="0.005"
                value={splatRadius}
                onChange={(e) => setSplatRadius(Number(e.target.value))}
                className="flex-1"
              />
              <b className="mono w-14 text-right">{splatRadius.toFixed(3)} m</b>
            </label>

            <Button
              fill
              small
              intent={Intent.PRIMARY}
              icon="refresh"
              onClick={() => void generateFromScan()}
            >
              Rebuild splats from scan
            </Button>

            {lastBufferRef.current && (
              <Button
                fill
                small
                icon="download"
                onClick={handleDownloadSplat}
              >
                Export .splat file…
              </Button>
            )}

            <label className="block">
              <span className="bp6-button bp6-fill bp6-small cursor-pointer text-center">
                Open .splat / .ply / .ksplat file…
              </span>
              <input
                type="file"
                accept=".splat,.ply,.ksplat"
                className="hidden"
                onChange={(e) => void handleLoadExternalFile(e)}
              />
            </label>

            <p className="text-[11px] text-gray-400">{error ?? status}</p>
          </div>
        </div>
      )}
    </div>
  )
}
