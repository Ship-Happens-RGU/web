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
import { useScanSession } from '@/composables/useScanSession'
import { openScanInViewer } from '@/services/scanLoader'
import type { Scan } from '@/types/models'
import { formatBytes, formatDate, formatDateTime } from '@/utils/format'
import UploadScanDialog from '@/views/Scans/Components/UploadScanDialog'

export default function ScanTimeline() {
  const { viewerTreeId, selectedScanId, selectScan, closeViewerTree } = useScanSession()
  const treeQuery = useScanTree(viewerTreeId)
  const scansQuery = useTreeScans(viewerTreeId)

  const [isPlaying, setIsPlaying] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<number>(1) // 1x to 3x scale
  const [loadingScanId, setLoadingScanId] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

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

  // Function to load a scan into the viewer
  const loadScan = useCallback(
    async (scan: Scan) => {
      activeAbortRef.current?.abort()
      const controller = new AbortController()
      activeAbortRef.current = controller

      setLoadingScanId(scan.id)
      setLoadProgress(0)
      setLoadError(null)

      try {
        await openScanInViewer(scan, {
          signal: controller.signal,
          onProgress: (fraction) => {
            setLoadProgress(fraction)
          },
        })
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

  // Trigger loading when selectedScanId changes
  useEffect(() => {
    if (currentScan) {
      void loadScan(currentScan)
    }
    return () => {
      activeAbortRef.current?.abort()
    }
  }, [currentScan, loadScan])

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
  const clipWidth = 220 * zoomLevel
  const clipGap = 32 * zoomLevel

  if (!viewerTreeId) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={`${Classes.DARK} relative z-20 flex flex-col border-t border-white/10 bg-[#161616] select-none shadow-2xl transition-all`}
      style={{ height: '172px' }}
    >
      {/* Top Toolbar: Transport Controls, Timeline Scrubbing Status & Timecode */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#1e1e1e] px-4 text-xs">
        {/* Left: Tree badge and playback controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-white/90">
            <Icon icon="folder-open" size={14} className="text-[#30aedb]" />
            <span className="max-w-[180px] truncate">{treeQuery.data?.name ?? 'Scan Tree'}</span>
            <Tag minimal intent={Intent.PRIMARY}>
              {scans.length} {scans.length === 1 ? 'scan' : 'scans'}
            </Tag>
          </div>

          <div className="h-4 w-px bg-white/15" />

          {/* VCR / Video transport buttons */}
          <ButtonGroup minimal>
            <Tooltip content="Previous scan (History back)" placement="top">
              <Button
                icon="step-backward"
                small
                disabled={selectedIndex <= 0}
                onClick={handlePrev}
              />
            </Tooltip>

            <Tooltip content={isPlaying ? 'Pause auto-tour' : 'Play history auto-tour'} placement="top">
              <Button
                icon={isPlaying ? 'pause' : 'play'}
                small
                intent={isPlaying ? Intent.PRIMARY : undefined}
                disabled={scans.length <= 1}
                onClick={() => setIsPlaying((p) => !p)}
              />
            </Tooltip>

            <Tooltip content="Next scan (History forward)" placement="top">
              <Button
                icon="step-forward"
                small
                disabled={selectedIndex >= scans.length - 1}
                onClick={handleNext}
              />
            </Tooltip>
          </ButtonGroup>
        </div>

        {/* Center: Selected Scan readout / Timecode display */}
        <div className="flex items-center gap-2">
          {currentScan ? (
            <div className="flex items-center gap-2 rounded bg-black/40 px-2.5 py-1 font-mono text-[11px] text-[#30aedb]">
              <span className="text-white/40">TIMESTAMP:</span>
              <span className="font-semibold text-white/90">{formatDateTime(currentScan.scanDate)}</span>
              <span className="text-white/30">|</span>
              <span className="max-w-[140px] truncate text-white/70">{currentScan.name}</span>
            </div>
          ) : (
            <span className="text-white/40">No scans in this tree</span>
          )}

          {loadingScanId && (
            <div className="flex items-center gap-1.5 text-xs text-[#30aedb]">
              <Spinner size={12} intent={Intent.PRIMARY} />
              <span>
                {loadProgress !== null && loadProgress < 1
                  ? `Loading ${Math.round(loadProgress * 100)}%`
                  : 'Parsing point cloud…'}
              </span>
            </div>
          )}

          {loadError && (
            <Tooltip content={loadError} intent={Intent.DANGER}>
              <span className="flex items-center gap-1 text-xs text-red-400">
                <Icon icon="error" size={12} />
                <span>Load error</span>
              </span>
            </Tooltip>
          )}
        </div>

        {/* Right: Zoom controls and action buttons */}
        <div className="flex items-center gap-2">
          <ButtonGroup minimal>
            <Tooltip content="Zoom out timeline" placement="top">
              <Button
                icon="zoom-out"
                small
                disabled={zoomLevel <= 0.8}
                onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.25))}
              />
            </Tooltip>
            <Tooltip content="Zoom in timeline" placement="top">
              <Button
                icon="zoom-in"
                small
                disabled={zoomLevel >= 2.5}
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
              />
            </Tooltip>
          </ButtonGroup>

          <Button
            icon="cloud-upload"
            small
            intent={Intent.PRIMARY}
            onClick={() => setUploadDialogOpen(true)}
          >
            Upload scan
          </Button>

          <Tooltip content="Exit timeline and close tree" placement="top">
            <Button icon="cross" small minimal onClick={closeViewerTree} />
          </Tooltip>
        </div>
      </div>

      {/* Loading progress bar strip */}
      {loadingScanId && loadProgress !== null && (
        <div className="h-0.5 w-full bg-white/5">
          <ProgressBar
            intent={Intent.PRIMARY}
            value={loadProgress}
            animate
            stripes
            className="h-0.5! rounded-none!"
          />
        </div>
      )}

      {/* Timeline Ruler & Track area */}
      <div className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-[#141414] [scrollbar-width:thin]">
        {/* Ruler ticks background bar */}
        <div
          ref={trackRef}
          className="relative flex h-full items-stretch py-2 pl-8 pr-16"
          style={{
            minWidth: `${Math.max(1000, scans.length * (clipWidth + clipGap) + 120)}px`,
          }}
        >
          {/* Subtle time ruler bar at the top */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-5 border-b border-white/5 bg-[#181818]/80 text-[10px] text-white/40">
            <div className="flex h-full items-center px-4">
              <span className="font-mono tracking-wider uppercase text-[9px] text-white/30">
                HISTORY TIMELINE ◀ EARLIER &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; LATER ▶
              </span>
            </div>
          </div>

          {/* Scans timeline track */}
          <div className="mt-4 flex items-center gap-6">
            {scans.map((scan, idx) => {
              const isSelected = scan.id === selectedScanId
              const isLoading = scan.id === loadingScanId

              return (
                <div
                  key={scan.id}
                  data-scan-id={scan.id}
                  onClick={() => selectScan(scan.id)}
                  style={{ width: `${clipWidth}px` }}
                  className={`group relative flex h-20 shrink-0 cursor-pointer flex-col justify-between rounded-md border p-2.5 transition-all ${
                    isSelected
                      ? 'border-[#30aedb] bg-[#1a2d38] shadow-[0_0_15px_rgba(48,174,219,0.35)] ring-1 ring-[#30aedb]'
                      : 'border-white/10 bg-[#1c1c1c] hover:border-white/30 hover:bg-[#232323]'
                  }`}
                >
                  {/* Playhead needle when active */}
                  {isSelected && (
                    <div className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                      <div className="h-0 w-0 border-x-4 border-x-transparent border-t-[6px] border-t-[#30aedb]" />
                      <div className="h-4 w-0.5 bg-[#30aedb]" />
                    </div>
                  )}

                  {/* Clip Header: Date tag + Format badge */}
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span
                      className={`font-semibold ${
                        isSelected ? 'text-[#30aedb]' : 'text-white/80 group-hover:text-white'
                      }`}
                    >
                      {formatDate(scan.scanDate)}
                    </span>

                    <Tag
                      minimal
                      intent={isSelected ? Intent.PRIMARY : Intent.NONE}
                      className="font-mono text-[10px]"
                    >
                      {scan.fileName.split('.').pop()?.toUpperCase() ?? 'SCAN'}
                    </Tag>
                  </div>

                  {/* Clip Body: Scan Name */}
                  <div className="my-0.5 truncate text-[12px] font-medium text-white/90" title={scan.name}>
                    {scan.name}
                  </div>

                  {/* Clip Footer: File size & Status */}
                  <div className="flex items-center justify-between text-[10px] text-white/50">
                    <span>{formatBytes(scan.fileSize)}</span>

                    {isLoading ? (
                      <span className="flex items-center gap-1 text-[#30aedb]">
                        <Spinner size={10} intent={Intent.PRIMARY} />
                        <span>Opening</span>
                      </span>
                    ) : isSelected ? (
                      <span className="font-medium text-[#30aedb]">Active in 3D</span>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100 text-white/70">Click to view</span>
                    )}
                  </div>

                  {/* Chronological connector line between clips */}
                  {idx < scans.length - 1 && (
                    <div
                      className="pointer-events-none absolute top-1/2 -right-6 h-0.5 w-6 -translate-y-1/2 bg-white/10"
                    />
                  )}
                </div>
              )
            })}

            {/* Empty state when tree has no scans */}
            {scans.length === 0 && !scansQuery.isPending && (
              <div className="flex items-center gap-3 pl-4 text-xs text-white/50">
                <span>No scans uploaded to this tree yet.</span>
                <Button
                  small
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

