import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  ButtonGroup,
  Classes,
  Icon,
  Intent,
  ProgressBar,
  Spinner,
  Tag,
  Tooltip,
} from '@blueprintjs/core'
import { useScanTree } from '@/composables/ApiWrappers/Scans/useScanTree'
import { useTreeScans } from '@/composables/ApiWrappers/Scans/useTreeScans'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { useScanSession, type ScanRepresentation } from '@/composables/useScanSession'
import { canConvertToModel, generateScanModel } from '@/services/modelConverter'
import { downloadScan, forgetModel, openModelInViewer, openScanInViewer } from '@/services/scanLoader'
import type { Scan } from '@/types/models'
import { formatBytes, formatDate, formatDateTime } from '@/utils/format'
import UploadScanDialog from '@/views/Scans/Components/UploadScanDialog'

export default function ScanTimeline() {
  const { viewerTreeId, selectedScanId, selectScan, representation, setRepresentation } = useScanSession()
  const queryClient = useQueryClient()
  const treeQuery = useScanTree(viewerTreeId)
  const scansQuery = useTreeScans(viewerTreeId)

  const [isPlaying, setIsPlaying] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<number>(1) // 1x to 3x scale
  const [loadingScanId, setLoadingScanId] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  /** What is on screen for the current scan, which can differ from the choice when there is no model. */
  const [shown, setShown] = useState<ScanRepresentation | null>(null)
  const [loadNote, setLoadNote] = useState<string | null>(null)
  const [generating, setGenerating] = useState<{ scanId: string; fraction: number; message: string } | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const generateAbortRef = useRef<AbortController | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const playTimerRef = useRef<number | null>(null)
  const activeAbortRef = useRef<AbortController | null>(null)

  const scans = useMemo(() => scansQuery.data ?? [], [scansQuery.data])

  // Select the initial scan if none selected yet
  useEffect(() => {
    if (scans.length > 0 && (!selectedScanId || !scans.some((s) => s.id === selectedScanId))) {
      // Default to latest scan (last in chronological array)
      selectScan(scans[scans.length - 1].id)
    }
  }, [scans, selectedScanId, selectScan])

  const selectedIndex = useMemo(() => {
    return scans.findIndex((s) => s.id === selectedScanId)
  }, [scans, selectedScanId])

  const currentScan = selectedIndex >= 0 ? scans[selectedIndex] : null

  // Function to load a scan into the viewer: its 3D model first when it has one, else the point cloud
  const loadScan = useCallback(
    async (scan: Scan, want: ScanRepresentation) => {
      activeAbortRef.current?.abort()
      const controller = new AbortController()
      activeAbortRef.current = controller

      setLoadingScanId(scan.id)
      setLoadProgress(0)
      setLoadError(null)
      setLoadNote(null)

      const onProgress = (fraction: number) => {
        setLoadProgress(fraction)
      }

      try {
        let opened: ScanRepresentation = 'points'

        if (want === 'model' && scan.model) {
          try {
            await openModelInViewer(scan, { signal: controller.signal, onProgress })
            opened = 'model'
          } catch (err: unknown) {
            if ((err as Error)?.name === 'AbortError') {
              throw err
            }

            setLoadNote(`Model failed to load (${(err as Error)?.message ?? 'unknown error'}), showing the point cloud`)
            setLoadProgress(0)
          }
        }

        if (opened === 'points') {
          await openScanInViewer(scan, { signal: controller.signal, onProgress })
        }

        if (controller.signal.aborted) {
          return
        }

        setShown(opened)
        setLoadingScanId(null)
        setLoadProgress(null)
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          setLoadError((err as Error)?.message || 'Failed to open scan in viewer')
          setLoadingScanId(null)
          setLoadProgress(null)
        }
      }
    },
    [],
  )

  // Trigger loading when the selected scan, its model, or the chosen representation changes
  useEffect(() => {
    if (currentScan) {
      void loadScan(currentScan, representation)
    }
    return () => {
      activeAbortRef.current?.abort()
    }
  }, [currentScan, representation, loadScan])

  /** Converts an already-uploaded E57 into a model (download, convert in the browser, upload). */
  const handleGenerateModel = async (scan: Scan) => {
    generateAbortRef.current?.abort()
    const controller = new AbortController()
    generateAbortRef.current = controller
    setGenerateError(null)
    setGenerating({ scanId: scan.id, fraction: 0, message: 'Downloading scan…' })

    try {
      const file = await downloadScan(scan, {
        signal: controller.signal,
        onProgress: (f) => setGenerating({ scanId: scan.id, fraction: f * 0.2, message: 'Downloading scan…' }),
      })
      await generateScanModel(scan.id, file, {
        signal: controller.signal,
        onProgress: (p) => setGenerating({ scanId: scan.id, fraction: 0.2 + p.fraction * 0.8, message: p.message }),
      })
      forgetModel(scan.id)
      setRepresentation('model')
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.treeScans(scan.treeId) })
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setGenerateError((err as Error)?.message || 'Could not generate the model')
      }
    } finally {
      setGenerating(null)
    }
  }

  useEffect(() => () => generateAbortRef.current?.abort(), [])

  // Auto-scroll the timeline to keep the selected scan clip in view
  useEffect(() => {
    if (selectedScanId && trackRef.current) {
      const activeEl = trackRef.current.querySelector(`[data-scan-id="${selectedScanId}"]`)
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [selectedScanId])

  // Video editor playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current)
        playTimerRef.current = null
      }
      return
    }

    if (scans.length <= 1) {
      setIsPlaying(false)
      return
    }

    playTimerRef.current = window.setInterval(() => {
      if (loadingScanId) {
        // Wait until current scan completes loading before advancing
        return
      }

      const nextIdx = (selectedIndex + 1) % scans.length
      selectScan(scans[nextIdx].id)
    }, 4500)

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current)
        playTimerRef.current = null
      }
    }
  }, [isPlaying, scans, selectedIndex, selectScan, loadingScanId])

  const handlePrev = () => {
    if (selectedIndex > 0) {
      selectScan(scans[selectedIndex - 1].id)
    }
  }

  const handleNext = () => {
    if (selectedIndex < scans.length - 1) {
      selectScan(scans[selectedIndex + 1].id)
    }
  }

  // Calculate timeline geometry
  const clipWidth = 150 * zoomLevel
  const clipGap = 16 * zoomLevel

  if (!viewerTreeId) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={`${Classes.DARK} relative z-20 flex h-full min-h-[92px] flex-col border-t border-white/10 bg-[#161616] select-none transition-all`}
    >
      {/* Top Toolbar: Transport Controls, Timecode & Actions */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/10 bg-[#1e1e1e] px-3 text-xs">
        {/* Left: Playback controls and scan count */}
        <div className="flex items-center gap-2">
          <ButtonGroup minimal>
            <Tooltip content="Previous scan (History back)" placement="top">
              <Button
                icon="step-backward"
                size="small"
                disabled={selectedIndex <= 0}
                onClick={handlePrev}
              />
            </Tooltip>

            <Tooltip content={isPlaying ? 'Pause auto-tour' : 'Play history auto-tour'} placement="top">
              <Button
                icon={isPlaying ? 'pause' : 'play'}
                size="small"
                intent={isPlaying ? Intent.PRIMARY : undefined}
                disabled={scans.length <= 1}
                onClick={() => setIsPlaying((p) => !p)}
              />
            </Tooltip>

            <Tooltip content="Next scan (History forward)" placement="top">
              <Button
                icon="step-forward"
                size="small"
                disabled={selectedIndex >= scans.length - 1}
                onClick={handleNext}
              />
            </Tooltip>
          </ButtonGroup>

          <Tag minimal intent={Intent.PRIMARY} className="text-[10px]">
            {scans.length} {scans.length === 1 ? 'scan' : 'scans'}
          </Tag>
        </div>

        {/* Center: Selected Scan readout */}
        <div className="flex items-center gap-2 min-w-0">
          {currentScan ? (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-white/80 truncate">
              <span className="font-semibold text-[#30aedb]">{formatDateTime(currentScan.scanDate)}</span>
            </div>
          ) : (
            <span className="text-white/40">No scans in this tree</span>
          )}

          {loadingScanId && (
            <div className="flex items-center gap-1 text-[11px] text-[#30aedb] shrink-0">
              <Spinner size={11} intent={Intent.PRIMARY} />
              <span>
                {loadProgress !== null && loadProgress < 1
                  ? `${Math.round(loadProgress * 100)}%`
                  : 'Parsing…'}
              </span>
            </div>
          )}

          {loadNote && (
            <Tooltip content={loadNote} intent={Intent.WARNING}>
              <span className="flex items-center gap-1 text-[11px] text-amber-400 shrink-0">
                <Icon icon="warning-sign" size={12} />
                <span>Point cloud</span>
              </span>
            </Tooltip>
          )}

          {loadError && (
            <Tooltip content={loadError} intent={Intent.DANGER}>
              <span className="flex items-center gap-1 text-[11px] text-red-400 shrink-0">
                <Icon icon="error" size={12} />
                <span>Error</span>
              </span>
            </Tooltip>
          )}
        </div>

        {/* Right: Model / point cloud, zoom controls and Upload */}
        <div className="flex items-center gap-1.5">
          {currentScan && (
            <ButtonGroup>
              <Tooltip
                placement="top"
                content={
                  currentScan.model
                    ? `3D model · ${formatBytes(currentScan.model.fileSize)}${
                        currentScan.model.triangleCount
                          ? ` · ${currentScan.model.triangleCount.toLocaleString()} triangles`
                          : ''
                      }`
                    : 'This scan has no 3D model yet'
                }
              >
                <Button
                  icon="cube"
                  size="small"
                  disabled={!currentScan.model}
                  intent={shown === 'model' ? Intent.PRIMARY : Intent.NONE}
                  active={representation === 'model' && !!currentScan.model}
                  onClick={() => setRepresentation('model')}
                >
                  Model
                </Button>
              </Tooltip>
              <Tooltip placement="top" content={`Point cloud · ${formatBytes(currentScan.fileSize)}`}>
                <Button
                  icon="heatmap"
                  size="small"
                  intent={shown === 'points' ? Intent.PRIMARY : Intent.NONE}
                  active={representation === 'points' || !currentScan.model}
                  onClick={() => setRepresentation('points')}
                >
                  Point cloud
                </Button>
              </Tooltip>
            </ButtonGroup>
          )}

          {currentScan && !currentScan.model && canConvertToModel(currentScan.fileName) && (
            generating?.scanId === currentScan.id ? (
              <Tooltip content={generating.message} placement="top">
                <Button size="small" icon="stop" onClick={() => generateAbortRef.current?.abort()}>
                  {`Generating ${Math.round(generating.fraction * 100)}%`}
                </Button>
              </Tooltip>
            ) : (
              <Tooltip
                placement="top"
                intent={generateError ? Intent.DANGER : undefined}
                content={generateError ?? 'Convert this scan into a 3D model (GLB) that loads before the point cloud'}
              >
                <Button
                  size="small"
                  icon={generateError ? 'error' : 'build'}
                  disabled={!!generating}
                  onClick={() => void handleGenerateModel(currentScan)}
                >
                  Generate model
                </Button>
              </Tooltip>
            )
          )}

          <ButtonGroup minimal>
            <Tooltip content="Zoom out timeline" placement="top">
              <Button
                icon="zoom-out"
                size="small"
                disabled={zoomLevel <= 0.8}
                onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.25))}
              />
            </Tooltip>
            <Tooltip content="Zoom in timeline" placement="top">
              <Button
                icon="zoom-in"
                size="small"
                disabled={zoomLevel >= 2.5}
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
              />
            </Tooltip>
          </ButtonGroup>

          <Button
            icon="cloud-upload"
            size="small"
            intent={Intent.PRIMARY}
            onClick={() => setUploadDialogOpen(true)}
          >
            Upload
          </Button>
        </div>
      </div>

      {/* Loading progress bar strip */}
      {loadingScanId && loadProgress !== null && (
        <div className="h-1 w-full overflow-hidden bg-white/5">
          <ProgressBar
            intent={Intent.PRIMARY}
            value={loadProgress}
            animate
            stripes
            className="h-1! rounded-none!"
          />
        </div>
      )}

      {/* Timeline Track area */}
      <div className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-[#141414] [scrollbar-width:thin]">
        <div
          ref={trackRef}
          className="relative flex h-full items-center px-4"
          style={{
            minWidth: `${Math.max(800, scans.length * (clipWidth + clipGap) + 48)}px`,
          }}
        >
          {/* Scans timeline track */}
          <div className="flex items-center gap-4">
            {scans.map((scan, idx) => {
              const isSelected = scan.id === selectedScanId
              const isLoading = scan.id === loadingScanId

              return (
                <div
                  key={scan.id}
                  data-scan-id={scan.id}
                  onClick={() => selectScan(scan.id)}
                  style={{ width: `${clipWidth}px` }}
                  className={`group relative flex h-10 shrink-0 cursor-pointer items-center justify-between gap-2 rounded border px-2.5 transition-all ${
                    isSelected
                      ? 'border-[#30aedb] bg-[#1a2d38] shadow-[0_0_10px_rgba(48,174,219,0.28)] ring-1 ring-[#30aedb]'
                      : 'border-white/10 bg-[#1c1c1c] hover:border-white/30 hover:bg-[#232323]'
                  }`}
                >
                  <span
                    className={`truncate text-[11px] font-medium ${
                      isSelected ? 'text-[#30aedb]' : 'text-white/85 group-hover:text-white'
                    }`}
                  >
                    {formatDate(scan.scanDate)}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-white/55">
                    {isLoading && <Spinner size={10} intent={Intent.PRIMARY} />}
                    {scan.model && <Icon icon="cube" size={10} title="Has a 3D model" />}
                    <span>{formatBytes(scan.fileSize)}</span>
                  </div>

                  {/* Chronological connector line between clips */}
                  {idx < scans.length - 1 && (
                    <div
                      className="pointer-events-none absolute top-1/2 -right-4 h-0.5 w-4 -translate-y-1/2 bg-white/10"
                    />
                  )}
                </div>
              )
            })}

            {/* Empty state when tree has no scans */}
            {scans.length === 0 && !scansQuery.isPending && (
              <div className="flex items-center gap-3 pl-2 text-xs text-white/50">
                <span>No scans uploaded to this tree yet.</span>
                <Button
                  size="small"
                  intent={Intent.PRIMARY}
                  icon="cloud-upload"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  Upload first scan
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload dialog */}
      {treeQuery.data && (
        <UploadScanDialog
          tree={treeQuery.data}
          isOpen={uploadDialogOpen}
          onClose={() => setUploadDialogOpen(false)}
          onUploaded={(newScan) => {
            selectScan(newScan.id)
          }}
        />
      )}
    </div>
  )
}

