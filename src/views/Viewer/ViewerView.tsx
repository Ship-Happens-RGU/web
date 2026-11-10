import { useEffect, useRef, useState } from 'react'
import { Button, Intent, ProgressBar } from '@blueprintjs/core'
import PageHeader from '@/components/PageHeader'
import { Viewer, type Knobs, type Station } from '@/packages/viewer/src/viewer'
import { REC } from '@/packages/viewer/src/cells'

const DEFAULT_KNOBS: Knobs = {
  colorMode: 0,
  size: 2.0,
  sizeMode: 1,
  round: true,
  maxPx: 7,
  edl: true,
  edlStrength: 0.32,
  edlRadius: 1.4,
  normalShade: false,
  bright: 1,
  gamma: 1,
  iMin: 0,
  iMax: 1,
  clipZMin: -1e9,
  clipZMax: 1e9,
  budget: 8_000_000,
  density: 2.0,
  movingQuality: 0.35,
  flySpeed: 2,
}

const NB = 1024
const MEM_LIMIT = 3.2e9
const fmt = (n: number) => Math.round(n).toLocaleString()

interface ScanProgress {
  name: string
  status: string
  fraction: number
  points?: string
  extent?: string
}

export default function ViewerView() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const knobsRef = useRef<Knobs>({ ...DEFAULT_KNOBS })

  const [hasScan, setHasScan] = useState(false)
  const [loading, setLoading] = useState<ScanProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const v = new Viewer(canvas)
    v.setKnobs(knobsRef.current)
    viewerRef.current = v

    let rafId = 0
    const loop = () => {
      v.render()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      workerRef.current?.terminate()
      workerRef.current = null
      v.clear()
      v.renderer.dispose()
      viewerRef.current = null
    }
  }, [])

  function handlePickClick() {
    fileInputRef.current?.click()
  }

  function loadE57File(file: File) {
    const v = viewerRef.current
    if (!v) return

    if (file.size < 48) {
      setError('That file is too small to be an E57 scan.')
      return
    }

    workerRef.current?.terminate()
    workerRef.current = null

    v.clear()
    knobsRef.current = { ...DEFAULT_KNOBS }
    v.setKnobs(knobsRef.current)

    setError(null)
    setHasScan(true)
    setLoading({
      name: file.name,
      status: 'Opening scan…',
      fraction: 0,
    })

    const histogram = new Uint32Array(256)
    const axisHist = [new Uint32Array(NB), new Uint32Array(NB), new Uint32Array(NB)]
    let axisCube: { origin: number[]; size: number } | null = null
    let gotRealLeaf = false
    let revealed = false
    let totalPoints = 0

    const computeRobustBounds = () => {
      if (!axisCube) return

      const total = axisHist[0].reduce((a, b) => a + b, 0)

      if (!total) return

      const lo: [number, number, number] = [0, 0, 0]
      const hi: [number, number, number] = [0, 0, 0]

      for (let a = 0; a < 3; a++) {
        const h = axisHist[a]
        let acc = 0
        let l = 0
        let u = NB - 1

        for (let i = 0; i < NB; i++) {
          acc += h[i]
          if (acc >= total * 0.002) {
            l = i
            break
          }
        }

        acc = 0

        for (let i = NB - 1; i >= 0; i--) {
          acc += h[i]
          if (acc >= total * 0.002) {
            u = i
            break
          }
        }

        lo[a] = axisCube.origin[a] + (l / NB) * axisCube.size
        hi[a] = axisCube.origin[a] + ((u + 1) / NB) * axisCube.size
      }
      v.setRobustBounds(lo, hi)
    }

    const autoRangeIntensity = () => {
      const total = histogram.reduce((a, b) => a + b, 0)

      if (!total) return

      let acc = 0
      let lo = 0
      let hi = 255

      for (let i = 0; i < 256; i++) {
        acc += histogram[i]
        if (acc >= total * 0.01) {
          lo = i
          break
        }
      }

      acc = 0

      for (let i = 255; i >= 0; i--) {
        acc += histogram[i]
        if (acc >= total * 0.02) {
          hi = i
          break
        }
      }

      knobsRef.current.iMin = lo / 255
      knobsRef.current.iMax = Math.max(hi / 255, knobsRef.current.iMin + 0.02)
      v.setKnobs(knobsRef.current)
    }

    const worker = new Worker(
      new URL('../../packages/viewer/src/worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (ev: MessageEvent) => {
      const m = ev.data
      if (m.type === 'meta') {
        const s = m.meta?.scans?.[0]

        if (!s) {
          setLoading(null)
          setHasScan(false)
          setError('This E57 file contains no point clouds.')
          return
        }

        totalPoints = s.points ?? 0
        const b = s.bounds
        const extent = b
          ? `${(b[1] - b[0]).toFixed(1)} × ${(b[3] - b[2]).toFixed(1)} × ${(b[5] - b[4]).toFixed(1)} m`
          : undefined

        if (Array.isArray(m.meta.stations)) {
          v.setStations(m.meta.stations as Station[], s.translation ?? [0, 0, 0])
        }

        setLoading((prev) => ({
          name: s.name || prev?.name || file.name,
          points: fmt(totalPoints),
          extent,
          status: `Opened in ${m.openMs.toFixed(0)} ms`,
          fraction: 0.02,
        }))
      } else if (m.type === 'plan') {
        setLoading((prev) =>
          prev
            ? {
                ...prev,
                status:
                  m.stride > 1
                    ? `Decoding — keeping 1 in ${m.stride} (${fmt(m.willKeep)} points)`
                    : `Decoding ${fmt(m.willKeep)} points…`,
              }
            : prev,
        )
      } else if (m.type === 'preview') {
        const u8 = new Uint8Array(m.block)
        const u16 = new Uint16Array(m.block.byteLength >> 1)
        new Uint8Array(u16.buffer).set(u8.subarray(0, u16.length * 2))
        axisCube = { origin: m.meta.origin, size: m.meta.size }

        for (let i = 0; i < u8.length; i += REC) {
          histogram[u8[i + 9]]++
          const b = i >> 1
          axisHist[0][u16[b] >> 6]++
          axisHist[1][u16[b + 1] >> 6]++
          axisHist[2][u16[b + 2] >> 6]++
        }

        if (!gotRealLeaf) {
          v.addLeaf([m.block], m.count, m.meta, true)
        }
        
        if (!revealed && v.loaded + m.count > 150_000) {
          revealed = true
          computeRobustBounds()
          v.resize()
          v.fit()
        }
        v.applyZRange()
      } else if (m.type === 'progress') {
        if (m.phase === 0 && totalPoints > 0) {
          const pct = Math.min(1, m.done / totalPoints)
          const rate = m.done / Math.max(m.elapsed / 1000, 0.001)

          setLoading((prev) =>
            prev
              ? {
                  ...prev,
                  fraction: pct * 0.85,
                  status: `Decoding ${fmt(m.done)} pts · ${(rate / 1e6).toFixed(1)} M pts/s (${(pct * 100).toFixed(0)}%)`,
                }
              : prev,
          )
        } else {
          const pct = m.total > 0 ? 0.85 + (m.done / m.total) * 0.15 : 0.9

          setLoading((prev) =>
            prev
              ? {
                  ...prev,
                  fraction: pct,
                  status: `Building octree cells ${m.done} / ${m.total}…`,
                }
              : prev,
          )
        }
      } else if (m.type === 'leaf') {
        if (!gotRealLeaf) {
          gotRealLeaf = true
          v.dropPreview()
        }

        v.addLeaf(m.blocks, m.count, m.meta, false)
        v.applyZRange()
        
        if (!revealed) {
          revealed = true
          v.resize()
          v.fit()
        }
      } else if (m.type === 'done') {
        computeRobustBounds()
        v.applyZRange()
        autoRangeIntensity()
        v.resize()
        v.fit()
        setLoading(null)
        worker.terminate()
        workerRef.current = null
      } else if (m.type === 'error') {
        setLoading(null)
        setHasScan(false)
        setError(m.message || 'Failed to decode E57 scan.')
        worker.terminate()
        workerRef.current = null
      }
    }

    worker.onerror = (e) => {
      setLoading(null)
      setHasScan(false)
      setError(`Decoder error: ${e.message || 'out of memory'}`)
      worker.terminate()
      workerRef.current = null
    }

    worker.postMessage({
      type: 'open',
      file,
      scanIndex: 0,
      stride: 1,
      memLimit: MEM_LIMIT,
      kind: 'e57',
    })
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[#111111]">
      <PageHeader
        icon="cube"
        crumbs={[{ label: 'ShipHappens' }, { label: 'Viewer' }]}
        actions={
          hasScan ? (
            <Button
              intent={Intent.PRIMARY}
              icon="document-open"
              onClick={handlePickClick}
            >
              View from file
            </Button>
          ) : undefined
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".e57"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            loadE57File(f)
          }
          e.target.value = ''
        }}
      />

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#111111]">
        <canvas
          ref={canvasRef}
          className={`block h-full w-full ${hasScan ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        />
        <div id="labels" className="pointer-events-none absolute inset-0 overflow-hidden" />

        {!hasScan && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
            <Button
              intent={Intent.PRIMARY}
              size="large"
              icon="document-open"
              onClick={handlePickClick}
            >
              View from file
            </Button>
            {error && (
              <p className="text-body-2 text-[#b00020] max-w-md text-center">{error}</p>
            )}
          </div>
        )}

        {loading && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 w-full max-w-md -translate-x-1/2 rounded border border-white/10 bg-[#1c1c1c]/95 p-4 shadow-lg backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-subtitle-2 truncate text-white/87">{loading.name}</span>
              {loading.points && (
                <span className="text-caption shrink-0 font-mono text-white/60">
                  {loading.points} pts
                </span>
              )}
            </div>
            <ProgressBar
              intent={Intent.PRIMARY}
              value={loading.fraction}
              stripes={false}
              className="mb-2"
            />
            <div className="flex items-center justify-between gap-2 text-caption text-white/60">
              <span className="truncate">{loading.status}</span>
              {loading.extent && <span className="shrink-0 font-mono">{loading.extent}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
