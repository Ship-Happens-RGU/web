import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import {
  Alignment,
  Button,
  ButtonGroup,
  Callout,
  Card,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  H2,
  H3,
  HTMLSelect,
  Intent,
  Menu,
  MenuDivider,
  MenuItem,
  ProgressBar,
  Slider,
  Switch,
  Tag,
  Text,
} from '@blueprintjs/core'
import { useScanTree } from '@/composables/ApiWrappers/Scans/useScanTree'
import { useTreeScans } from '@/composables/ApiWrappers/Scans/useTreeScans'
import { useScanSession } from '@/composables/useScanSession'
import { openScanInViewer } from '@/services/scanLoader'
import { formatBytes, formatDate } from '@/utils/format'
import ScanTimeline from './Components/ScanTimeline'
import GaussianSplatOverlay from './Components/GaussianSplatOverlay'
import UnwrappedScanOverlay from './Components/UnwrappedScanOverlay'
import '@/packages/viewer/src/style.css'

type ViewMode =
  | 'points'
  | 'mesh'
  | 'stations'
  | 'raster'
  | 'splat'
  | 'sections'
  | 'unwrapped'

let viewerMainLoaded = false

export default function ViewerView({ active }: { active: boolean }) {
  const { viewerTreeId, selectedScanId, closeViewerTree } = useScanSession()
  const treeQuery = useScanTree(viewerTreeId)
  const scansQuery = useTreeScans(viewerTreeId)
  const scans = useMemo(() => scansQuery.data ?? [], [scansQuery.data])

  const [isComparing, setIsComparing] = useState(false)
  const [isCompareDialogOpen, setIsCompareDialogOpen] = useState(false)
  const [compareScanId, setCompareScanId] = useState<string | null>(null)
  const [compareOpacity, setCompareOpacity] = useState(0.6)
  const [isCompareLoading, setIsCompareLoading] = useState(false)
  const [compareLoadProgress, setCompareLoadProgress] = useState<number | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [isSwapped, setIsSwapped] = useState(false)
  const [alignmentStatus, setAlignmentStatus] = useState<string>('Overlaid')
  const [isIcpRunning, setIsIcpRunning] = useState(false)
  const [isBlinking, setIsBlinking] = useState(false)
  const blinkTimerRef = useRef<number | null>(null)
  const [activeViewModeTab, setActiveViewModeTab] = useState<ViewMode>('points')
  const [inspectorSlotEl, setInspectorSlotEl] = useState<HTMLDivElement | null>(
    null,
  )
  const [visibleWindows, setVisibleWindows] = useState({
    toolbar: true,
    viewport: true,
    inspector: true,
    timeline: true,
  })
  const [inspectorWidth, setInspectorWidth] = useState(320)
  const [timelineHeight, setTimelineHeight] = useState<number | null>(null)
  const [isPointCloudReady, setIsPointCloudReady] = useState(false)
  const [isViewsMenuOpen, setIsViewsMenuOpen] = useState(false)
  const viewsMenuRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isViewsMenuOpen) return
    const handlePointerDown = (e: MouseEvent) => {
      if (viewsMenuRef.current && !viewsMenuRef.current.contains(e.target as Node)) {
        setIsViewsMenuOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsViewsMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isViewsMenuOpen])

  const toggleWindow = useCallback(
    (key: 'toolbar' | 'viewport' | 'inspector' | 'timeline') => {
      setVisibleWindows((prev) => ({ ...prev, [key]: !prev[key] }))
      requestAnimationFrame(() => {
        ;(window as unknown as { __viewer?: any }).__viewer?.resize?.()
      })
    },
    [],
  )

  const resetLayout = useCallback(() => {
    setVisibleWindows({
      toolbar: true,
      viewport: true,
      inspector: true,
      timeline: true,
    })
    setInspectorWidth(320)
    setTimelineHeight(null)
    requestAnimationFrame(() => {
      ;(window as unknown as { __viewer?: any }).__viewer?.resize?.()
    })
  }, [])

  const startInspectorResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = inspectorWidth
      const onMove = (ev: MouseEvent) => {
        const next = Math.max(220, Math.min(640, startW + (startX - ev.clientX)))
        setInspectorWidth(next)
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        ;(window as unknown as { __viewer?: any }).__viewer?.resize?.()
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [inspectorWidth],
  )

  const startTimelineResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startY = e.clientY
      const startH = timelineHeight ?? 98
      const onMove = (ev: MouseEvent) => {
        const next = Math.max(88, Math.min(480, startH + (startY - ev.clientY)))
        setTimelineHeight(next)
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        ;(window as unknown as { __viewer?: any }).__viewer?.resize?.()
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [timelineHeight],
  )

  const baseScan = useMemo(() => {
    return scans.find((s) => s.id === selectedScanId) ?? (scans.length > 0 ? scans[scans.length - 1] : null)
  }, [scans, selectedScanId])

  const availableCompareScans = useMemo(() => {
    return scans.filter((s) => s.id !== baseScan?.id)
  }, [scans, baseScan])

  const alignClouds = useCallback((force = false) => {
    const viewer = (window as unknown as { __viewer?: any }).__viewer
    if (!viewer || viewer.entities.length < 2) return null
    const base = viewer.entities[0]
    const comp = viewer.entities[1]

    const baseBox = viewer.measuredBox(base)
    const compBox = viewer.measuredBox(comp)
    if (!baseBox || !compBox || baseBox.isEmpty() || compBox.isEmpty()) return null

    const baseCenter = baseBox.getCenter(new THREE.Vector3())
    const compCenter = compBox.getCenter(new THREE.Vector3())
    const d = baseCenter.clone().sub(compCenter)

    // Translate the comparison scan so its 3D bounding center overlays the base scan directly
    if (d.length() > 0.05 || force) {
      comp.cells.setModel(new THREE.Matrix4().makeTranslation(d.x, d.y, d.z).multiply(comp.cells.model))
      if (comp.robust) comp.robust.translate(d)
      viewer.applyZRange()
      viewer.dirty = true
      viewer.touch?.()
      viewer.fit?.()
      setAlignmentStatus(`Overlaid (centered · offset ${d.length().toFixed(2)}m)`)
    } else {
      setAlignmentStatus('Overlaid (matching coordinates)')
      viewer.fit?.()
    }
    return d
  }, [])

  const handleRunIcp = async () => {
    const viewer = (window as unknown as { __viewer?: any }).__viewer
    const app = (window as unknown as { __app?: any }).__app
    if (!viewer || viewer.entities.length < 2 || !app?.runIcp) return
    setIsIcpRunning(true)
    try {
      viewer.activeId = viewer.entities[1].id
      const regSelect = document.getElementById('k-regref') as HTMLSelectElement | null
      if (regSelect) regSelect.value = viewer.entities[0].id
      const res = await app.runIcp()
      if (res && typeof res.rms === 'number') {
        setAlignmentStatus(`Fine-aligned ICP: RMS ${(res.rms * 1000).toFixed(1)}mm (${Math.round((res.overlap ?? 1) * 100)}% overlap)`)
      }
      viewer.dirty = true
      viewer.touch?.()
    } catch (e: any) {
      setAlignmentStatus(`ICP: ${e?.message ?? 'Could not align'}`)
    } finally {
      setIsIcpRunning(false)
    }
  }

  const handleToggleBlink = () => {
    setIsBlinking((prev) => {
      const next = !prev
      if (blinkTimerRef.current) {
        window.clearInterval(blinkTimerRef.current)
        blinkTimerRef.current = null
      }
      if (next) {
        let showPink = false
        blinkTimerRef.current = window.setInterval(() => {
          showPink = !showPink
          const viewer = (window as unknown as { __viewer?: any }).__viewer
          if (viewer && viewer.entities.length >= 2) {
            const compIndex = isSwapped ? 0 : 1
            viewer.entities[compIndex].visible = showPink
            viewer.dirty = true
            viewer.touch?.()
          }
        }, 600)
      } else {
        const viewer = (window as unknown as { __viewer?: any }).__viewer
        if (viewer && viewer.entities.length >= 2) {
          const compIndex = isSwapped ? 0 : 1
          viewer.entities[compIndex].visible = true
          viewer.entities[compIndex].opacity = compareOpacity
          viewer.dirty = true
          viewer.touch?.()
        }
      }
      return next
    })
  }

  const handleExitCompare = useCallback(() => {
    if (blinkTimerRef.current) {
      window.clearInterval(blinkTimerRef.current)
      blinkTimerRef.current = null
    }
    setIsBlinking(false)
    const viewer = (window as unknown as { __viewer?: any }).__viewer
    if (viewer) {
      while (viewer.entities.length > 1) {
        viewer.removeEntity(viewer.entities[1].id)
      }
      if (viewer.entities[0]) {
        viewer.entities[0].tint = { on: false, color: '#ffffff', weight: 0.0 }
        viewer.entities[0].opacity = 1.0
        viewer.entities[0].depthBias = 0.0
        viewer.entities[0].visible = true
      }
      viewer.dirty = true
      viewer.touch?.()
      viewer.fit?.()
    }
    setIsComparing(false)
    setIsSwapped(false)
  }, [])

  useEffect(() => {
    setActiveViewModeTab('points')
    setIsPointCloudReady(false)
    if (isComparing) {
      handleExitCompare()
    }
  }, [selectedScanId, viewerTreeId, handleExitCompare])

  useEffect(() => {
    if (!viewerTreeId || isPointCloudReady) return
    const timer = window.setInterval(() => {
      const viewer = (window as unknown as { __viewer?: any }).__viewer
      const loadingEl = document.getElementById('loading')
      const isLoadingVisible = loadingEl ? !loadingEl.classList.contains('hidden') : false
      if (
        viewer &&
        viewer.loaded > 0 &&
        viewer.pendingUploads === 0 &&
        !isLoadingVisible
      ) {
        setIsPointCloudReady(true)
      }
    }, 200)
    return () => window.clearInterval(timer)
  }, [viewerTreeId, isPointCloudReady])

  const handleSelectViewMode = useCallback(
    (mode: ViewMode) => {
      const viewer = (window as unknown as { __viewer?: any }).__viewer
      const app = (window as unknown as { __app?: any }).__app

      if (activeViewModeTab === mode) {
        return
      }

      setActiveViewModeTab(mode)

      if (mode === 'points') {
        viewer?.exitBubble?.()
        app?.setDisplay?.('points')
        viewer?.fit?.()
        return
      }

      if (mode === 'mesh') {
        viewer?.exitBubble?.()
        const hasMesh =
          (app?.meshEntities?.()?.length ?? 0) > 0 ||
          (app?.meshData?.idx?.length ?? 0) > 0
        if (hasMesh) {
          app?.setDisplay?.('mesh')
        }
        return
      }

      if (mode === 'stations') {
        void app?.openPanorama?.(0)
        return
      }

      if (mode === 'raster') {
        viewer?.exitBubble?.()
        viewer?.topDown?.()
        if (!app?.raster) {
          void app?.rasterize?.()
        }
        return
      }

      if (mode === 'sections') {
        viewer?.exitBubble?.()
        return
      }

      if (mode === 'splat' || mode === 'unwrapped') {
        viewer?.exitBubble?.()
      }
    },
    [activeViewModeTab],
  )

  const handleCompareButtonClick = () => {
    if (isComparing) {
      handleExitCompare()
    } else {
      setCompareError(null)
      if (availableCompareScans.length > 0 && (!compareScanId || !availableCompareScans.some((s) => s.id === compareScanId))) {
        setCompareScanId(availableCompareScans[0].id)
      }
      setIsCompareDialogOpen(true)
    }
  }

  const startComparison = async () => {
    if (!compareScanId) return
    const targetScan = scans.find((s) => s.id === compareScanId)
    if (!targetScan) return

    setIsCompareLoading(true)
    setCompareLoadProgress(0)
    setCompareError(null)

    try {
      const viewer = (window as unknown as { __viewer?: any }).__viewer
      if (viewer) {
        while (viewer.entities.length > 1) {
          viewer.removeEntity(viewer.entities[1].id)
        }
        if (viewer.entities[0]) {
          viewer.entities[0].tint = { on: false, color: '#ffffff', weight: 0.0 }
          viewer.entities[0].opacity = 1.0
        }
      }

      await openScanInViewer(targetScan, {
        add: true,
        compare: true,
        compareOpacity,
        onProgress: (p) => setCompareLoadProgress(p),
      })

      if (viewer && viewer.entities.length >= 2) {
        viewer.entities[0].tint = { on: false, color: '#ffffff', weight: 0.0 }
        viewer.entities[0].opacity = 1.0
        viewer.entities[0].depthBias = 0.0
        viewer.entities[1].tint = { on: true, color: '#ffb6c1', weight: 1.0 }
        viewer.entities[1].opacity = compareOpacity
        viewer.entities[1].depthBias = 0.003
        alignClouds(false)
        viewer.dirty = true
        viewer.touch?.()
        viewer.fit?.()
      }

      setIsComparing(true)
      setIsSwapped(false)
      setIsCompareDialogOpen(false)
    } catch (err: unknown) {
      setCompareError((err as Error)?.message || 'Failed to load comparison scan')
    } finally {
      setIsCompareLoading(false)
      setCompareLoadProgress(null)
    }
  }

  const handleOpacityChange = (val: number) => {
    setCompareOpacity(val)
    const viewer = (window as unknown as { __viewer?: any }).__viewer
    if (viewer && viewer.entities.length >= 2) {
      const compIndex = isSwapped ? 0 : 1
      viewer.entities[compIndex].opacity = val
      viewer.dirty = true
      viewer.touch?.()
    }
  }

  const handleSwapScans = () => {
    const viewer = (window as unknown as { __viewer?: any }).__viewer
    if (!viewer || viewer.entities.length < 2) return
    const nextSwapped = !isSwapped
    setIsSwapped(nextSwapped)

    if (nextSwapped) {
      viewer.entities[0].tint = { on: true, color: '#ffb6c1', weight: 1.0 }
      viewer.entities[0].opacity = compareOpacity
      viewer.entities[0].depthBias = 0.003
      viewer.entities[1].tint = { on: false, color: '#ffffff', weight: 0.0 }
      viewer.entities[1].opacity = 1.0
      viewer.entities[1].depthBias = 0.0
    } else {
      viewer.entities[0].tint = { on: false, color: '#ffffff', weight: 0.0 }
      viewer.entities[0].opacity = 1.0
      viewer.entities[0].depthBias = 0.0
      viewer.entities[1].tint = { on: true, color: '#ffb6c1', weight: 1.0 }
      viewer.entities[1].opacity = compareOpacity
      viewer.entities[1].depthBias = 0.003
    }
    viewer.dirty = true
    viewer.touch?.()
  }

  useEffect(() => {
    if (!viewerMainLoaded) {
      viewerMainLoaded = true

      void import('@/packages/viewer/src/main').then(() => {
        const v = (window as unknown as { __viewer?: { resize: () => void } }).__viewer
        v?.resize()
      })
    } else {
      const v = (window as unknown as { __viewer?: { canvas?: HTMLCanvasElement; resize: () => void } }).__viewer
      const host = viewportRef.current
      if (v?.canvas && host) {
        const placeholder = host.querySelector('#gl')
        if (placeholder && placeholder !== v.canvas) {
          placeholder.replaceWith(v.canvas)
          v.resize()
        }
      }
    }
  }, [])

  useEffect(() => {
    if (active) {
      const id = requestAnimationFrame(() => {
        const v = (window as unknown as { __viewer?: { resize: () => void } }).__viewer
        v?.resize()
      })

      return () => cancelAnimationFrame(id)
    }
  }, [active, viewerTreeId])

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col bg-[#111111] ${
        active ? '' : 'hidden'
      }`}
    >
      {viewerTreeId && (
        <div className="shrink-0 flex h-16 min-h-16 items-center justify-between gap-4 px-6 bg-[#1c1c1c] border-b border-white/10 text-xs">
          <div className="flex items-center gap-2 text-gray-300">
            {treeQuery.data?.name && (
              <>
                <span className="text-base font-semibold text-white/87">
                  {treeQuery.data.name}
                </span>
                <span className="text-gray-600">·</span>
              </>
            )}
            <Tag id="tb-layer" minimal className="hidden" />
            <Text className="mono text-[11px] text-gray-400" id="tb-points">
              —
            </Text>
            <span className="text-gray-600">·</span>
            <Text className="mono text-[11px] text-gray-400" id="tb-fps">
              —
            </Text>
            <Tag id="tb-tool" intent={Intent.PRIMARY} minimal className="hidden" />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">

              <div className="flex items-center gap-1 pr-2 border-r border-[#333333]">
                <Button id="tb-undo" size="small" variant="minimal" disabled title="Undo (⌘Z)">
                  Undo
                </Button>
                <Button id="tb-redo" size="small" variant="minimal" disabled title="Redo (⇧⌘Z)">
                  Redo
                </Button>
                <Button id="tb-save" size="small" variant="minimal" disabled title="Save as… (⌘S)">
                  Save as…
                </Button>
                <Button
                  id="tb-compare"
                  size="small"
                  icon="comparison"
                  variant={isComparing ? 'solid' : 'minimal'}
                  intent={isComparing ? Intent.PRIMARY : Intent.NONE}
                  title={isComparing ? 'Exit scan comparison' : 'Compare two scans in this scan tree'}
                  onClick={handleCompareButtonClick}
                >
                  {isComparing ? 'Exit compare' : 'Compare'}
                </Button>
                <Button
                  id="tb-close"
                  size="small"
                  intent={Intent.DANGER}
                  variant="minimal"
                  icon="cross"
                  title="Close scan"
                  onClick={() => {
                    handleExitCompare()
                    closeViewerTree()
                  }}
                >
                  Close scan
                </Button>
              </div>

              <div ref={viewsMenuRef} className="relative">
                <Button
                  size="small"
                  icon="panel-stats"
                  rightIcon="caret-down"
                  variant="minimal"
                  text="Views"
                  active={isViewsMenuOpen}
                  onClick={() => setIsViewsMenuOpen((open) => !open)}
                />
                {isViewsMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded border border-[#333333] bg-[#252526] shadow-xl">
                    <Menu className="bg-transparent!">
                      <MenuItem
                        icon={visibleWindows.toolbar ? 'tick' : 'blank'}
                        text="View Modes Bar"
                        onClick={() => toggleWindow('toolbar')}
                      />
                      <MenuItem
                        icon={visibleWindows.viewport ? 'tick' : 'blank'}
                        text="Scene Viewport"
                        onClick={() => toggleWindow('viewport')}
                      />
                      <MenuItem
                        icon={visibleWindows.inspector ? 'tick' : 'blank'}
                        text="Inspector"
                        onClick={() => toggleWindow('inspector')}
                      />
                      <MenuItem
                        icon={visibleWindows.timeline ? 'tick' : 'blank'}
                        text="Timeline"
                        onClick={() => toggleWindow('timeline')}
                      />
                      <MenuDivider />
                      <MenuItem
                        icon="reset"
                        text="Reset Layout"
                        onClick={() => {
                          resetLayout()
                          setIsViewsMenuOpen(false)
                        }}
                      />
                    </Menu>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {!viewerTreeId && (
        <div className="flex-1 flex items-center justify-center bg-[#111111] text-sm text-gray-400">
          Nothing selected from scan tree
        </div>
      )}

      <div
        className={`viewer-root bp6-dark min-h-0 flex-1 flex! flex-col! ${
          !viewerTreeId ? 'hidden' : ''
        }`}
      >
        <div
          className={`shrink-0 bg-[#1e1e1e] border-b border-[#2a2a2a] ${
            !visibleWindows.toolbar ? 'hidden' : ''
          }`}
        >

          <div className="flex flex-wrap items-center justify-center gap-1 px-3 py-1.5 bg-[#191919] text-xs text-white">
            <Button
              small
              minimal={activeViewModeTab !== 'points'}
              intent={
                activeViewModeTab === 'points' ? Intent.PRIMARY : Intent.NONE
              }
              icon="scatter-plot"
              onClick={() => handleSelectViewMode('points')}
            >
              3D Point Cloud
            </Button>
            <Button
              small
              minimal={activeViewModeTab !== 'mesh'}
              intent={activeViewModeTab === 'mesh' ? Intent.PRIMARY : Intent.NONE}
              icon="cube"
              disabled={!isPointCloudReady}
              title={!isPointCloudReady ? 'Waiting for point cloud to finish rendering…' : undefined}
              onClick={() => handleSelectViewMode('mesh')}
            >
              3D Triangle Mesh
            </Button>
            <Button
              small
              minimal={activeViewModeTab !== 'stations'}
              intent={
                activeViewModeTab === 'stations' ? Intent.PRIMARY : Intent.NONE
              }
              icon="camera"
              disabled={!isPointCloudReady}
              title={!isPointCloudReady ? 'Waiting for point cloud to finish rendering…' : undefined}
              onClick={() => handleSelectViewMode('stations')}
            >
              360° Panorama
            </Button>
            <Button
              small
              minimal={activeViewModeTab !== 'raster'}
              intent={
                activeViewModeTab === 'raster' ? Intent.PRIMARY : Intent.NONE
              }
              icon="map"
              disabled={!isPointCloudReady}
              title={!isPointCloudReady ? 'Waiting for point cloud to finish rendering…' : undefined}
              onClick={() => handleSelectViewMode('raster')}
            >
              2D Height & Contours
            </Button>
            <Button
              small
              minimal={activeViewModeTab !== 'splat'}
              intent={
                activeViewModeTab === 'splat' ? Intent.PRIMARY : Intent.NONE
              }
              icon="cloud"
              disabled={!isPointCloudReady}
              title={!isPointCloudReady ? 'Waiting for point cloud to finish rendering…' : undefined}
              onClick={() => handleSelectViewMode('splat')}
            >
              3D Gaussian Splatting
            </Button>
            <Button
              small
              minimal={activeViewModeTab !== 'sections'}
              intent={
                activeViewModeTab === 'sections' ? Intent.PRIMARY : Intent.NONE
              }
              icon="layers"
              disabled={!isPointCloudReady}
              title={!isPointCloudReady ? 'Waiting for point cloud to finish rendering…' : undefined}
              onClick={() => handleSelectViewMode('sections')}
            >
              2D Slices & Floor Plans
            </Button>
            <Button
              small
              minimal={activeViewModeTab !== 'unwrapped'}
              intent={
                activeViewModeTab === 'unwrapped' ? Intent.PRIMARY : Intent.NONE
              }
              icon="media"
              disabled={!isPointCloudReady}
              title={!isPointCloudReady ? 'Waiting for point cloud to finish rendering…' : undefined}
              onClick={() => handleSelectViewMode('unwrapped')}
            >
              Depth / Intensity 2D
            </Button>
            <Button
              small
              minimal
              icon="cross"
              title="Hide Toolbar & Modes"
              onClick={() => toggleWindow('toolbar')}
            />
          </div>
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div
            ref={viewportRef}
            className={`relative flex-1 min-w-0 min-h-0 bg-[#111111] overflow-hidden ${
              !visibleWindows.viewport ? 'hidden' : ''
            }`}
          >
            <canvas id="gl" />

            {activeViewModeTab === 'splat' && (
              <GaussianSplatOverlay inspectorEl={inspectorSlotEl} />
            )}

            {activeViewModeTab === 'unwrapped' && (
              <UnwrappedScanOverlay inspectorEl={inspectorSlotEl} />
            )}

            {inspectorSlotEl &&
              createPortal(
                <div
                  className={`p-3 border-b border-[#2a2a2a] text-xs text-white ${
                    activeViewModeTab &&
                    activeViewModeTab !== 'points' &&
                    activeViewModeTab !== 'splat' &&
                    activeViewModeTab !== 'unwrapped'
                      ? ''
                      : 'hidden'
                  }`}
                >
                  <div className="mb-2 pb-1.5 border-b border-[#2a2a2a] font-semibold text-gray-200">
                    {activeViewModeTab === 'mesh' &&
                      '3D Triangle Mesh (Surface Reconstruction)'}
                    {activeViewModeTab === 'stations' &&
                      '360° Panorama / Station Views'}
                    {activeViewModeTab === 'raster' &&
                      '2D Elevation / Height Maps & Contours'}
                    {activeViewModeTab === 'sections' &&
                      '2D Cross-Sections, Slices & Floor Plans'}
                  </div>

            <div
              className={`grp ${activeViewModeTab === 'sections' ? '' : 'hidden'}`}
              data-grp="sections"
            >
              <Button
                id="k-secadd"
                intent={Intent.PRIMARY}
                fill
                size="small"
                className="mb-1.5"
              >
                Add section at orbit point
              </Button>

              <ButtonGroup fill className="mb-2">
                <Button
                  size="small"
                  icon="compass"
                  onClick={() => {
                    const viewer = (window as unknown as { __viewer?: any }).__viewer
                    viewer?.topDown?.()
                  }}
                >
                  Top-down plan
                </Button>
                <Button
                  size="small"
                  icon="camera"
                  onClick={() => {
                    const viewer = (window as unknown as { __viewer?: any }).__viewer
                    const url = viewer?.snapshot?.(2048, 'png')
                    if (url) {
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'cross-section.png'
                      a.click()
                    }
                  }}
                >
                  Save slice PNG…
                </Button>
              </ButtonGroup>

              <ul id="sec-list" className="mlist" />

              <p className="statusline" id="v-sections">
                —
              </p>

              <details className="sub">
                <summary>How this works</summary>
                <p className="hint">
                  Bounding shapes, combined as a union: keep only what lies inside any of them, or mark one <b>Remove</b> to drop what is inside it. A section is a slab you move, tilt and thicken with the gizmo — floors, a wall, a corridor.
                </p>
              </details>
            </div>

            <div
              className={`grp ${activeViewModeTab === 'mesh' ? '' : 'hidden'}`}
              data-grp="mesh"
            >
              <label className="row">
                <span>Detail</span>
                <input
                  type="range"
                  id="k-mvox"
                  min="0.5"
                  max="60"
                  step="0.5"
                  defaultValue="6"
                />
                <b className="mono" id="v-mvox">
                  6 cm
                </b>
              </label>

              <label className="row">
                <span>Smoothing</span>
                <input
                  type="range"
                  id="k-msmooth"
                  min="0"
                  max="6"
                  step="1"
                  defaultValue="2"
                />
                <b className="mono" id="v-msmooth">
                  2
                </b>
              </label>

              <label className="row">
                <span>Fill gaps</span>
                <input
                  type="range"
                  id="k-mtrunc"
                  min="1"
                  max="4"
                  step="0.5"
                  defaultValue="2"
                />
                <b className="mono" id="v-mtrunc">
                  2.0
                </b>
              </label>

              <Button
                id="k-mbuild"
                intent={Intent.PRIMARY}
                fill
                size="small"
                className="mb-1.5"
              >
                Build from points…
              </Button>

              <p className="statusline" id="v-mesh">
                —
              </p>

              <p className="lab mono">SHOW</p>

              <ButtonGroup fill className="mb-2">
                <Button id="k-disppoints" size="small" className="on">
                  Points
                </Button>

                <Button id="k-dispmesh" size="small">
                  Mesh
                </Button>

                <Button id="k-dispboth" size="small">
                  Both
                </Button>
              </ButtonGroup>

              <Switch
                id="k-mflat"
                label="Flat shading"
                alignIndicator={Alignment.END}
                className="row flex! w-full items-center justify-between"
              />

              <p className="lab mono mesh-have">EDIT</p>

              <ButtonGroup fill className="mb-2 mesh-have">
                <Button id="k-meshflip" size="small">
                  Flip
                </Button>

                <Button id="k-meshsmooth" size="small">
                  Smooth
                </Button>

                <Button id="k-meshdecim" size="small">
                  Decimate
                </Button>
              </ButtonGroup>

              <label className="row mesh-have">
                <span>Smooth passes</span>
                <input
                  type="range"
                  id="k-meshiter"
                  min="1"
                  max="20"
                  step="1"
                  defaultValue="5"
                />
                <b className="mono" id="v-meshiter">
                  5
                </b>
              </label>

              <Switch
                id="k-meshtaubin"
                label="Keep volume"
                alignIndicator={Alignment.END}
                defaultChecked
                className="row mesh-have w-full items-center justify-between"
              />

              <label className="row mesh-have">
                <span>Decimate to</span>
                <input
                  type="range"
                  id="k-meshcell"
                  min="0.5"
                  max="100"
                  step="0.5"
                  defaultValue="10"
                />
                <b className="mono" id="v-meshcell">
                  10 cm
                </b>
              </label>

              <p className="lab mono mesh-have">MEASURE</p>

              <Button
                id="k-meshmeasure"
                fill
                size="small"
                className="mb-1.5 mesh-have"
              >
                Area and volume
              </Button>

              <p className="lab mono mesh-have">COMPARE</p>

              <label className="row mesh-have">
                <span>Distance to</span>
                <HTMLSelect id="k-meshref" />
              </label>

              <Switch
                id="k-meshsigned"
                label="Signed"
                alignIndicator={Alignment.END}
                className="row mesh-have w-full items-center justify-between"
              />

              <Button
                id="k-meshdist"
                fill
                size="small"
                className="mb-1.5 mesh-have"
              >
                Distance from this cloud
              </Button>

              <p className="lab mono mesh-have">SAMPLE</p>

              <label className="row mesh-have">
                <span>Sample</span>
                <HTMLSelect id="k-meshsmode" defaultValue="count">
                  <option value="count">points in all</option>
                  <option value="density">points per m²</option>
                </HTMLSelect>
              </label>

              <label className="row mesh-have">
                <span>How many</span>
                <input
                  type="number"
                  id="k-meshsval"
                  min="100"
                  step="1000"
                  defaultValue="200000"
                />
              </label>

              <Button
                id="k-meshsample"
                fill
                size="small"
                className="mb-1.5 mesh-have"
              >
                Sample to a new layer
              </Button>

              <label className="row mesh-have">
                <span>Format</span>
                <HTMLSelect id="k-meshfmt" defaultValue="ply">
                  <option value="ply">PLY (binary)</option>
                  <option value="obj">OBJ</option>
                  <option value="stl">STL (binary)</option>
                </HTMLSelect>
              </label>

              <Button
                id="k-meshsave"
                intent={Intent.PRIMARY}
                fill
                size="small"
                className="mb-1.5 mesh-have"
              >
                Export mesh…
              </Button>

              <Button id="k-mclear" fill size="small" className="mb-1.5 mesh-have">
                Discard mesh
              </Button>

              <p className="statusline" id="v-meshinfo">
                no mesh yet
              </p>

              <Button id="k-meshopen" fill size="small" className="mb-1.5">
                Import a mesh…
              </Button>

              <p className="hint">
                Opens a PLY, OBJ or STL as a layer of its own, to compare against or edit.
              </p>

              <details className="sub">
                <summary>How this works</summary>
                <p className="hint">
                  <b>Build from points</b> is surface reconstruction: it needs normals, and writes a triangle mesh as a separate object that you can show, hide, measure or export. <b>Detail</b> is the voxel size, so smaller is finer and slower, and below the scan&apos;s own point spacing it only adds noise. <b>Fill gaps</b> widens the band each point writes, closing small holes at the cost of rounding sharp edges.
                </p>
                <p className="hint">
                  <b>Area</b> and <b>volume</b> are measured through the layer&apos;s transform. A volume only means anything when the mesh is closed, so the boundary edge count is reported next to it. <b>Smooth</b> is Taubin with Keep volume on and plain Laplacian with it off. <b>Decimate</b> is vertex clustering at the cell you set, which is fast but cannot hit an exact triangle count.
                </p>
                <p className="hint">
                  <b>Distance from this cloud</b> measures every point of the active point layer to the nearest triangle of the mesh layer you pick, and writes it as a scalar field.
                </p>
              </details>
            </div>

            <div
              className={`grp ${activeViewModeTab === 'stations' ? '' : 'hidden'}`}
              data-grp="stations"
            >
              <Switch
                id="k-stations"
                label="Show stations"
                alignIndicator={Alignment.END}
                defaultChecked
                className="row flex! w-full items-center justify-between"
              />

              <p className="statusline" id="v-stations">
                —
              </p>

              <div id="bubble-ui" className="hidden">
                <label className="row">
                  <span>Points over photo</span>
                  <input
                    type="range"
                    id="k-blend"
                    min="0"
                    max="1"
                    step="0.01"
                    defaultValue="0.35"
                  />
                  <b className="mono" id="v-blend">
                    0.35
                  </b>
                </label>

                <Button id="k-bubble-exit" fill size="small" className="mb-1.5">
                  Leave photo
                </Button>
              </div>

              <p className="hint">
                Click a station marker to look around its 360° photo. Walk away and it fades.
              </p>
            </div>

            <div
              className={`grp ${activeViewModeTab === 'raster' ? '' : 'hidden'}`}
              data-grp="raster"
            >
              <label className="row">
                <span>Cell size</span>
                <input
                  type="range"
                  id="k-rcell"
                  min="0.01"
                  max="2"
                  step="0.01"
                  defaultValue="0.25"
                />
                <b className="mono" id="v-rcell">
                  0.25 m
                </b>
              </label>

              <label className="row">
                <span>Value</span>
                <HTMLSelect id="k-rstat" defaultValue="max">
                  <option value="max">Highest point</option>
                  <option value="min">Lowest point</option>
                  <option value="mean">Mean height</option>
                  <option value="density">Points per cell</option>
                  <option value="field">Mean scalar field</option>
                </HTMLSelect>
              </label>

              <label className="row">
                <span>Along</span>
                <HTMLSelect id="k-raxis" defaultValue="z">
                  <option value="z">Z (a height model)</option>
                  <option value="x">X</option>
                  <option value="y">Y</option>
                </HTMLSelect>
              </label>

              <label className="row">
                <span>Fill empty cells</span>
                <HTMLSelect id="k-rfill" defaultValue="none">
                  <option value="none">Leave empty</option>
                  <option value="nearest">Nearest</option>
                  <option value="idw">Inverse distance</option>
                </HTMLSelect>
              </label>

              <Button
                id="k-rasterize"
                intent={Intent.PRIMARY}
                fill
                size="small"
                className="mb-1.5"
              >
                Rasterize
              </Button>

              <p className="statusline" id="v-raster">
                —
              </p>

              <Switch
                id="k-rshow"
                label="Show the draped grid"
                alignIndicator={Alignment.END}
                defaultChecked
                className="row raster-have w-full items-center justify-between"
              />

              <Button
                id="k-rsavepng"
                fill
                size="small"
                className="mb-1.5 raster-have"
              >
                Save PNG + world file…
              </Button>

              <p className="lab mono">CONTOURS</p>

              <label className="row">
                <span>Interval</span>
                <input
                  type="range"
                  id="k-cint"
                  min="0.05"
                  max="5"
                  step="0.05"
                  defaultValue="0.5"
                />
                <b className="mono" id="v-cint">
                  0.50 m
                </b>
              </label>

              <Button id="k-contours" fill size="small" className="mb-1.5">
                Draw contours
              </Button>

              <ButtonGroup fill className="mb-2 contour-have">
                <Button id="k-cdxf" size="small">
                  Save DXF…
                </Button>

                <Button id="k-cgeojson" size="small">
                  Save GeoJSON…
                </Button>
              </ButtonGroup>

              <p className="statusline" id="v-contours">
                —
              </p>

              <p className="lab mono">VOLUME</p>

              <label className="row">
                <span>Against</span>
                <HTMLSelect id="k-vref" />
              </label>

              <label className="row">
                <span>Plane height</span>
                <input type="number" id="k-vplane" step="0.1" defaultValue="0" />
              </label>

              <Button id="k-volume" fill size="small" className="mb-1.5">
                Measure the volume
              </Button>

              <p className="statusline" id="v-volume">
                —
              </p>

              <details className="sub">
                <summary>How this works</summary>
                <p className="hint">
                  A 2.5D volume: the difference between two height rasters over the same cells, one cell area at a time. Cut and fill are reported separately because their sum hides both.
                </p>
              </details>
            </div>
          </div>,
                inspectorSlotEl,
              )}

          {isComparing && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center gap-3 bg-[#1e1e1e]/95 backdrop-blur-md px-4 py-2 rounded-lg border border-[#333333] shadow-2xl text-xs text-white">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_#34d399]" />
              <span className="font-semibold text-gray-300">Base:</span>
              <span
                className="max-w-[150px] truncate"
                title={isSwapped ? (scans.find(s => s.id === compareScanId)?.fileName ?? 'Overlay') : (baseScan?.fileName ?? 'Base')}
              >
                {isSwapped ? (scans.find(s => s.id === compareScanId)?.fileName ?? 'Overlay') : (baseScan?.fileName ?? 'Base')}
              </span>
              <Tag minimal intent={Intent.SUCCESS}>Normal</Tag>
            </div>

            <span className="text-gray-500 font-bold">vs</span>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffb6c1] inline-block shadow-[0_0_8px_#ffb6c1]" />
              <span className="font-semibold text-pink-300">Compare:</span>
              <span
                className="max-w-[150px] truncate"
                title={isSwapped ? (baseScan?.fileName ?? 'Base') : (scans.find(s => s.id === compareScanId)?.fileName ?? 'Overlay')}
              >
                {isSwapped ? (baseScan?.fileName ?? 'Base') : (scans.find(s => s.id === compareScanId)?.fileName ?? 'Overlay')}
              </span>
              <Tag minimal style={{ color: '#ffb6c1', borderColor: '#ffb6c1' }}>Light Pink</Tag>
            </div>

            <div className="flex items-center gap-2 pl-3 border-l border-gray-700">
              <span className="text-gray-400 font-medium">Opacity:</span>
              <Slider
                min={0.1}
                max={1.0}
                stepSize={0.05}
                labelStepSize={0.5}
                value={compareOpacity}
                onChange={handleOpacityChange}
                className="w-28! mb-0!"
                labelRenderer={(val) => `${Math.round(val * 100)}%`}
              />
            </div>

            <ButtonGroup minimal className="ml-1 items-center gap-1">
              <Button
                small
                icon="locate"
                title="Overlay scans directly by matching their centers"
                onClick={() => alignClouds(true)}
                text="Align"
              />
              <Button
                small
                icon="predictive-analysis"
                loading={isIcpRunning}
                title="Run ICP registration to lock scans together with millimeter precision"
                onClick={() => void handleRunIcp()}
                text="Fine ICP"
              />
              <Button
                small
                icon="flash"
                intent={isBlinking ? Intent.WARNING : Intent.NONE}
                title="Flicker the comparison scan on/off to immediately spot visual differences"
                onClick={handleToggleBlink}
                text={isBlinking ? 'Blinking' : 'Blink'}
              />
              <Button
                small
                icon="zoom-to-fit"
                title="Fit camera to frame both overlaid scans"
                onClick={() => (window as unknown as { __viewer?: any }).__viewer?.fit?.()}
              />
              <Button
                small
                icon="swap-horizontal"
                title="Swap base and compare scans"
                onClick={handleSwapScans}
                text="Swap"
              />
              <Button
                small
                intent={Intent.DANGER}
                icon="cross"
                title="Exit comparison"
                onClick={handleExitCompare}
              />
            </ButtonGroup>

            <span className="text-[10px] text-gray-400 bg-black/40 px-2 py-0.5 rounded border border-gray-800">
              {alignmentStatus}
            </span>
          </div>
          )}

        <div id="drop" className="bg-[#111111]!">
          <div className="flex flex-col items-center justify-center">
            <Button
              id="pick"
              intent={Intent.PRIMARY}
              size="large"
              icon="document-open"
            >
              View from file
            </Button>

            <p id="drop-lede" className="hidden" />
            <p id="drop-hint" className="hidden" />

            <div id="scan-card" className="hidden">
              <Button id="pick2" fill>
                View from file
              </Button>
            </div>

            <div id="cached" className="hidden">
              <ul id="cached-list" />
            </div>
          </div>
        </div>

        <div id="loading" className="hidden over">
          <Card elevation={3} className="card">
            <div className="scanrow hidden">
              <span className="lab mono">SCAN</span>
              <span id="ld-name">—</span>
            </div>

            <div className="scanrow hidden">
              <span className="lab mono">POINTS</span>
              <span className="mono" id="ld-points">—</span>
            </div>

            <div className="scanrow hidden">
              <span className="lab mono">EXTENT</span>
              <span className="mono" id="ld-extent">—</span>
            </div>

            <div className="scanrow hidden">
              <span className="lab mono">SENSOR</span>
              <span id="ld-sensor">—</span>
            </div>

            <div className="scanrow hidden">
              <span className="lab mono">FIELDS</span>
              <span id="ld-fields">—</span>
            </div>

            <div className="bar">
              <i id="ld-bar" />
            </div>

            <p className="statusline" id="ld-stat">
              opening…
            </p>
          </Card>
        </div>
          </div>

          <div
            onMouseDown={startInspectorResize}
            title="Drag to resize Inspector"
            className={`w-1.5 shrink-0 cursor-col-resize bg-[#222222] hover:bg-blue-500/70 transition-colors ${
              !visibleWindows.inspector ? 'hidden' : ''
            }`}
          />

          <aside
            style={{ width: inspectorWidth }}
            className={`shrink-0 border-l border-[#2a2a2a] bg-[#1e1e1e] flex flex-col min-h-0 ${
              !visibleWindows.inspector ? 'hidden' : ''
            }`}
          >
            <div className="px-3 py-1.5 border-b border-[#2a2a2a] bg-[#242424] text-xs font-semibold text-gray-200 flex items-center justify-between shrink-0">
              <span>Inspector</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-normal text-gray-400 uppercase tracking-wider">
                  {activeViewModeTab}
                </span>
                <Button
                  small
                  minimal
                  icon="cross"
                  title="Hide Inspector"
                  onClick={() => toggleWindow('inspector')}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div ref={setInspectorSlotEl} />

              <Card
                id="panel"
                elevation={0}
                className="static! w-full! inset-auto! max-h-none! border-0! rounded-none! shadow-none! bg-transparent! p-0! block!"
              >
                <div id="grabber" aria-hidden="true" className="hidden!">
                  <i />
                </div>

          <div className="grp" data-grp="layers">
            <H3>Layers</H3>

            <ul id="layer-list" className="mlist" />

            <ButtonGroup fill className="mb-2">
              <Button id="k-layeradd" size="small">
                Add file…
              </Button>

              <Button id="k-layerclone" size="small">
                Clone
              </Button>
            </ButtonGroup>

            <Button id="k-layermerge" fill size="small" className="mb-1.5">
              Merge into active…
            </Button>

            <Switch
              id="k-layertint"
              label="Tint this layer"
              alignIndicator={Alignment.END}
              className="row flex! w-full items-center justify-between"
            />

            <label className="row">
              <span>Colour</span>
              <input type="color" id="k-layercolor" defaultValue="#66ccff" />
            </label>

            <p className="statusline" id="v-layers">
              —
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Every visible layer is drawn; the <b>active</b> one (click its name) is what every tool works on. Double-click a name to rename it. <b>Add file…</b> opens another scan alongside this one — so does dropping a file with <b>Shift</b> held — while <b>Open file…</b> replaces everything. A tint multiplies a layer&apos;s colour so two overlapping scans can be told apart.
              </p>
            </details>
          </div>

          <div className="grp">
            <H3>Appearance</H3>

            <label className="row">
              <span>Colour</span>
              <HTMLSelect id="k-color" defaultValue="0">
                <option value="0">RGB</option>
                <option value="1">Intensity</option>
                <option value="2">RGB × Intensity</option>
                <option value="3">Elevation</option>
                <option value="4">Normals</option>
                <option value="5" id="k-color-sf" disabled>
                  Scalar field
                </option>
                <option value="6">Flat</option>
              </HTMLSelect>
            </label>

            <label className="row">
              <span>Point size</span>
              <input
                type="range"
                id="k-size"
                min="0.5"
                max="8"
                step="0.1"
                defaultValue="2.5"
              />
              <b className="mono" id="v-size">
                2.5
              </b>
            </label>

            <label className="row">
              <span>Sizing</span>
              <HTMLSelect id="k-sizemode" defaultValue="1">
                <option value="1">Adaptive</option>
                <option value="0">Fixed</option>
              </HTMLSelect>
            </label>

            <Switch
              id="k-round"
              label="Round points"
              alignIndicator={Alignment.END}
              defaultChecked
              className="row flex! w-full items-center justify-between"
            />
          </div>

          <div className="grp">
            <H3>Lighting</H3>

            <Switch
              id="k-edl"
              label="EDL"
              alignIndicator={Alignment.END}
              defaultChecked
              className="row flex! w-full items-center justify-between"
            />

            <label className="row">
              <span>Strength</span>
              <input
                type="range"
                id="k-edlstr"
                min="0"
                max="1.5"
                step="0.01"
                defaultValue="0.32"
              />
              <b className="mono" id="v-edlstr">
                0.32
              </b>
            </label>

            <label className="row">
              <span>Radius</span>
              <input
                type="range"
                id="k-edlrad"
                min="0.5"
                max="5"
                step="0.1"
                defaultValue="1.4"
              />
              <b className="mono" id="v-edlrad">
                1.4
              </b>
            </label>

            <Switch
              id="k-nrm"
              label="Normal shading"
              alignIndicator={Alignment.END}
              className="row flex! w-full items-center justify-between"
            />
          </div>

          <div className="grp">
            <H3>Tone</H3>

            <label className="row">
              <span>Brightness</span>
              <input
                type="range"
                id="k-bright"
                min="0.2"
                max="3"
                step="0.01"
                defaultValue="1"
              />
              <b className="mono" id="v-bright">
                1.00
              </b>
            </label>

            <label className="row">
              <span>Gamma</span>
              <input
                type="range"
                id="k-gamma"
                min="0.4"
                max="2.4"
                step="0.01"
                defaultValue="1"
              />
              <b className="mono" id="v-gamma">
                1.00
              </b>
            </label>

            <div className="row col">
              <span>Intensity range</span>

              <canvas id="hist" width="240" height="42" />

              <div className="dual">
                <input
                  type="range"
                  id="k-imin"
                  min="0"
                  max="1"
                  step="0.005"
                  defaultValue="0"
                />
                <input
                  type="range"
                  id="k-imax"
                  min="0"
                  max="1"
                  step="0.005"
                  defaultValue="1"
                />
              </div>

              <b className="mono" id="v-irange">
                0.00 – 1.00
              </b>
            </div>
          </div>

          <div className="grp" data-grp="clean">
            <H3>Clean</H3>

            <label className="row">
              <span title="How many nearest points each measurement looks at.">
                Neighbours
              </span>
              <input
                type="range"
                id="k-ank2"
                min="3"
                max="64"
                step="1"
                defaultValue="16"
              />
              <b className="mono" id="v-ank2">
                16
              </b>
            </label>

            <label className="row">
              <span title="How many standard deviations from the mean a point may be before it is dropped.">
                Strictness
              </span>
              <input
                type="range"
                id="k-ansigma"
                min="0.5"
                max="4"
                step="0.1"
                defaultValue="1.0"
              />
              <b className="mono" id="v-ansigma">
                1.0 σ
              </b>
            </label>

            <Button
              id="k-ansor"
              intent={Intent.PRIMARY}
              fill
              size="small"
              className="mb-1.5"
            >
              Remove outliers…
            </Button>

            <Button id="k-annoise" fill size="small" className="mb-1.5">
              Remove noise…
            </Button>

            <details className="sub">
              <summary>Noise filter options</summary>

              <label className="row">
                <span title="CloudCompare calls this the neighbours option. A sphere is its default.">
                  Neighbourhood
                </span>
                <HTMLSelect id="k-annbmode" defaultValue="radius">
                  <option value="radius">Sphere of a radius</option>
                  <option value="knn">Nearest neighbours</option>
                </HTMLSelect>
              </label>

              <label className="row">
                <span>Radius</span>
                <input
                  type="range"
                  id="k-annradius"
                  min="0.01"
                  max="2"
                  step="0.01"
                  defaultValue="0.15"
                />
                <b className="mono" id="v-annradius">
                  0.15 m
                </b>
              </label>

              <label className="row">
                <span title="CloudCompare calls this the error option. Relative is its default.">
                  Threshold
                </span>
                <HTMLSelect id="k-anerrmode" defaultValue="relative">
                  <option value="relative">Relative, in sigma</option>
                  <option value="absolute">Absolute distance</option>
                </HTMLSelect>
              </label>

              <label className="row">
                <span>Absolute</span>
                <input
                  type="range"
                  id="k-annabs"
                  min="0.001"
                  max="0.5"
                  step="0.001"
                  defaultValue="0.02"
                />
                <b className="mono" id="v-annabs">
                  0.020 m
                </b>
              </label>

              <Switch
                id="k-annrip"
                label="Remove isolated points"
                alignIndicator={Alignment.END}
                className="row flex! w-full items-center justify-between"
              />
            </details>

            <Button id="k-andup" fill size="small" className="mb-1.5">
              Remove duplicates…
            </Button>

            <p className="statusline" id="v-clean">
              —
            </p>

            <p className="hint">
              CloudCompare&apos;s SOR and noise filters, same settings, same points removed.
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                <b>Remove outliers</b> measures each point&apos;s mean distance to its neighbours and drops the ones beyond the mean plus <b>Strictness</b> standard deviations, judged over the whole cloud. A few very distant points can push that threshold out past the real outliers, so crop a stray reflection away first.
              </p>
              <p className="hint">
                <b>Remove noise</b> fits a plane to the points around each point and drops it if it sits further off that plane than its own neighbours&apos; spread allows. The threshold is local, so a smooth wall is judged strictly and a hedge loosely. Real edges survive because they still fit a plane.
              </p>
              <p className="hint">Every removal is one undoable step.</p>
            </details>
          </div>

          <div className="grp" data-grp="transform">
            <H3>Transform</H3>

            <p className="statusline" id="v-transform">
              no transform
            </p>

            <p className="lab mono">TRANSLATE</p>

            <div className="trio">
              <input
                type="number"
                id="k-tx"
                step="0.1"
                defaultValue="0"
                aria-label="East / X metres"
              />
              <input
                type="number"
                id="k-ty"
                step="0.1"
                defaultValue="0"
                aria-label="North / Y metres"
              />
              <input
                type="number"
                id="k-tz"
                step="0.1"
                defaultValue="0"
                aria-label="Up / Z metres"
              />
            </div>

            <Button id="k-tmove" fill size="small" className="mb-1.5">
              Move by these metres
            </Button>

            <p className="lab mono">ROTATE</p>

            <div className="row">
              <span>Axis</span>
              <HTMLSelect id="k-taxis" defaultValue="z">
                <option value="z">Z (plan)</option>
                <option value="x">X</option>
                <option value="y">Y</option>
              </HTMLSelect>
            </div>

            <div className="row">
              <span>Degrees</span>
              <input
                type="number"
                id="k-tdeg"
                step="0.5"
                defaultValue="90"
                aria-label="degrees"
              />
            </div>

            <div className="row">
              <span>About</span>
              <HTMLSelect id="k-tabout" defaultValue="centre">
                <option value="centre">Bounding-box centre</option>
                <option value="origin">Origin</option>
              </HTMLSelect>
            </div>

            <Button id="k-trot" fill size="small" className="mb-1.5">
              Rotate
            </Button>

            <p className="lab mono">SCALE</p>

            <div className="row">
              <span>Factor</span>
              <input
                type="number"
                id="k-tscale"
                step="0.01"
                defaultValue="1"
                aria-label="uniform scale factor"
              />
            </div>

            <Button id="k-tscalego" fill size="small" className="mb-1.5">
              Scale about the centre
            </Button>

            <p className="lab mono">FIT</p>

            <Button id="k-tlevel" fill size="small" className="mb-1.5">
              Level (make horizontal)
            </Button>

            <Button id="k-tcentre" fill size="small" className="mb-1.5">
              Move centre to origin
            </Button>

            <Button id="k-tmincorner" fill size="small" className="mb-1.5">
              Move min corner to origin
            </Button>

            <p className="lab mono">BY HAND</p>

            <Switch
              id="k-tdrag"
              label="Drag to move/rotate"
              alignIndicator={Alignment.END}
              className="row flex! w-full items-center justify-between"
            />

            <ButtonGroup fill className="mb-2">
              <Button id="k-tmodemove" size="small" className="on">
                Move
              </Button>

              <Button id="k-tmoderotate" size="small">
                Rotate
              </Button>

              <Button id="k-tmodescale" size="small">
                Scale
              </Button>
            </ButtonGroup>

            <ButtonGroup fill className="mb-2">
              <Button id="k-tmatrix" size="small">
                Apply matrix…
              </Button>

              <Button id="k-treset" size="small">
                Reset
              </Button>
            </ButtonGroup>

            <p className="lab mono">GLOBAL SHIFT</p>

            <p className="statusline" id="v-shift">
              —
            </p>

            <Button id="k-tshift" fill size="small" className="mb-1.5">
              Edit global shift…
            </Button>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Moves the whole cloud without touching a point. The records stay exactly as they are and a 4&times;4 matrix is applied when they are drawn, tested, analysed and exported — instant, lossless and undoable. <b>Save a copy</b> bakes it into the file.
              </p>
              <p className="hint">
                The gizmo grabs the whole cloud at its bounding-box centre. It shares the handles with the crop region, so turning it on releases the crop gizmo and vice versa. One undo step per drag.
              </p>
              <p className="hint">
                The scan&apos;s own pose offset, added back on export and shown in the coordinate readout. It is not part of the transform above and moves nothing on screen.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="analysis">
            <H3>Analysis</H3>

            <label className="row">
              <span title="How many nearest points each measurement looks at. Larger is smoother and slower.">
                Neighbours
              </span>
              <input
                type="range"
                id="k-ank"
                min="6"
                max="64"
                step="1"
                defaultValue="16"
              />
              <b className="mono" id="v-ank">
                16
              </b>
            </label>

            <p className="lab mono">NORMALS</p>

            <ButtonGroup fill className="mb-2">
              <Button id="k-annorm" size="small">
                Compute
              </Button>

              <Button id="k-anorient" size="small">
                Orient
              </Button>

              <Button id="k-aninvert" size="small">
                Invert
              </Button>
            </ButtonGroup>

            <p className="hint">
              Reconstruction and shading both need normals. <b>Orient</b> turns them toward the scanner stations.
            </p>

            <p className="lab mono">MEASURE</p>

            <label className="row">
              <span>Feature</span>
              <HTMLSelect id="k-anfeat" defaultValue="roughness">
                <option value="roughness">Roughness</option>
                <option value="curvature">Curvature</option>
                <option value="planarity">Planarity</option>
                <option value="linearity">Linearity</option>
                <option value="sphericity">Sphericity</option>
                <option value="anisotropy">Anisotropy</option>
                <option value="omnivariance">Omnivariance</option>
                <option value="eigenentropy">Eigenentropy</option>
                <option value="verticality">Verticality</option>
                <option value="volume_density">Volume density</option>
                <option value="surface_density">Surface density</option>
                <option value="neighbours">Neighbour count</option>
                <option value="eig1">1st eigenvalue</option>
                <option value="eig2">2nd eigenvalue</option>
                <option value="eig3">3rd eigenvalue</option>
              </HTMLSelect>
            </label>

            <Button id="k-anfeatgo" fill size="small" className="mb-1.5">
              Compute feature
            </Button>

            <p className="lab mono">CLUSTER AND THIN</p>

            <label className="row">
              <span>Spacing</span>
              <input
                type="range"
                id="k-anspace"
                min="0.01"
                max="2"
                step="0.01"
                defaultValue="0.1"
              />
              <b className="mono" id="v-anspace">
                0.10 m
              </b>
            </label>

            <ButtonGroup fill className="mb-2">
              <Button id="k-ancc" size="small">
                Components
              </Button>

              <Button id="k-ansub" size="small">
                Thin…
              </Button>
            </ButtonGroup>

            <p className="hint">
              <b>Components</b> labels groups of points that touch within the spacing. <b>Thin</b> keeps one point per cube of that size.
            </p>

            <p className="statusline" id="v-analysis">
              —
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                A feature is one number per point, computed from the shape of its neighbourhood and written as a scalar field. Colour by it with <b>Colour → Scalar field</b>, or narrow the range to isolate part of the cloud.
              </p>
            </details>
          </div>

          <div className="grp sf-have" data-grp="field">
            <H3>Scalar field</H3>

            <p className="statusline" id="v-sfname">
              no field
            </p>

            <canvas id="sf-hist" height="52" />

            <label className="row">
              <span>Display from</span>
              <input
                type="range"
                id="k-sfmin"
                min="0"
                max="1000"
                step="1"
                defaultValue="0"
              />
              <b className="mono" id="v-sfmin">
                —
              </b>
            </label>

            <label className="row">
              <span>to</span>
              <input
                type="range"
                id="k-sfmax"
                min="0"
                max="1000"
                step="1"
                defaultValue="1000"
              />
              <b className="mono" id="v-sfmax">
                —
              </b>
            </label>

            <Button id="k-sfauto" fill size="small" className="mb-1.5">
              Auto range (2–98%)
            </Button>

            <Switch
              id="k-sffilter"
              label="Filter points"
              alignIndicator={Alignment.END}
              className="row flex! w-full items-center justify-between"
            />

            <label className="row sf-filtering">
              <span>Keep from</span>
              <input
                type="range"
                id="k-sflo"
                min="0"
                max="1000"
                step="1"
                defaultValue="0"
              />
              <b className="mono" id="v-sflo">
                —
              </b>
            </label>

            <label className="row sf-filtering">
              <span>to</span>
              <input
                type="range"
                id="k-sfhi"
                min="0"
                max="1000"
                step="1"
                defaultValue="1000"
              />
              <b className="mono" id="v-sfhi">
                —
              </b>
            </label>

            <Switch
              id="k-sfhide"
              label="Hide the rest"
              alignIndicator={Alignment.END}
              className="row sf-filtering w-full items-center justify-between"
            />

            <Button
              id="k-sfapply"
              intent={Intent.PRIMARY}
              fill
              size="small"
              className="mb-1.5 sf-filtering"
            >
              Delete points outside…
            </Button>

            <Button id="k-sfclear" fill size="small" className="mb-1.5">
              Clear field
            </Button>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                A field is one number per point. Colour by it with <b>Colour → Scalar field</b>, narrow the display range to see detail, or filter to keep only part of the cloud.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="measure">
            <H3>Measure</H3>

            <ButtonGroup fill className="mb-2">
              <Button id="k-measure" size="small">
                Distance
              </Button>

              <Button id="k-measureclear" size="small">
                Clear
              </Button>
            </ButtonGroup>

            <p className="hint">
              Click two points. <b>M</b> toggles. Single-click anywhere shows coordinates.
            </p>

            <ul id="measure-list" className="mlist mono" />
          </div>

          <div className="grp" data-grp="export">
            <H3>Export</H3>

            <label className="row">
              <span>Format</span>
              <HTMLSelect id="k-fmt" defaultValue="e57">
                <option value="e57">E57</option>
                <option value="las">LAS 1.2</option>
                <option value="laz">LAZ (compressed)</option>
                <option value="ply">PLY (binary)</option>
              </HTMLSelect>
            </label>

            <label className="row">
              <span>Keep</span>
              <HTMLSelect id="k-expstride" defaultValue="1">
                <option value="1">Every point</option>
                <option value="2">1 in 2</option>
                <option value="4">1 in 4</option>
                <option value="10">1 in 10</option>
              </HTMLSelect>
            </label>

            <Button
              id="k-export"
              intent={Intent.PRIMARY}
              fill
              size="small"
              className="mb-1.5"
            >
              Save a copy…
            </Button>

            <p className="statusline" id="v-export">
              —
            </p>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Writes what is in memory — the crop, if you applied one. The original file is never touched.
              </p>
            </details>
          </div>

          <div className="grp" data-grp="cache">
            <H3>Cache</H3>

            <p className="statusline" id="v-cache">
              —
            </p>

            <Button id="k-cache" fill size="small" className="mb-1.5">
              Cache this scan on this device
            </Button>

            <Button
              id="k-cacheremove"
              fill
              size="small"
              className="mb-1.5 hidden"
            >
              Remove from cache
            </Button>

            <Button id="k-viewlink" fill size="small" className="mb-1.5">
              Copy view link
            </Button>

            <details className="sub">
              <summary>How this works</summary>
              <p className="hint">
                Writes decoded cells on this device so the next open is instant. <b>Save</b> (in Performance) also updates this cache after a crop, and clears undo.
              </p>
            </details>
          </div>

          <div className="grp">
            <H3>View</H3>

            <Button id="k-fly" fill size="small" className="on mb-2">
              Fly
            </Button>

            <label className="row">
              <span>Fly speed</span>
              <input
                type="range"
                id="k-flyspeed"
                min="0.1"
                max="30"
                step="0.1"
                defaultValue="2"
              />
              <b className="mono" id="v-flyspeed">
                2.0
              </b>
            </label>

            <Button id="k-top" fill size="small" className="mb-1.5">
              Top down
            </Button>

            <Button id="k-fit" fill size="small" className="mb-1.5">
              Fit to cloud
            </Button>

            <p className="hint" id="v-navhint">
              <b>W A S D</b> move · <b>Q E</b> down/up · drag to look · scroll changes speed · <b>Shift</b> ×4 · double-click moves toward a point
            </p>
          </div>
              </Card>
            </div>
          </aside>
        </div>

        <ButtonGroup id="toolbar" className="hidden">
          <Button data-tool="fly" size="small" className="on">
            Fly
          </Button>

          <Button data-tool="measure" size="small">
            Measure
          </Button>

          <Button data-tool="segment" size="small">
            Region
          </Button>

          <Button data-tool="crop" size="small">
            Crop
          </Button>

          <Button data-tool="photo" size="small" className="hidden">
            Leave photo
          </Button>
        </ButtonGroup>

        <div id="joy" className="hidden">
          <div className="pad">
            <Button data-key="w" className="up">
              ▲
            </Button>

            <Button data-key="a" className="left">
              ◀
            </Button>

            <Button data-key="d" className="right">
              ▶
            </Button>

            <Button data-key="s" className="down">
              ▼
            </Button>
          </div>

          <div className="vert">
            <Button data-key="e">up</Button>
            <Button data-key="q">down</Button>
          </div>
        </div>

        <svg id="seg" className="hidden">
          <polygon id="seg-fill" />
          <polyline id="seg-line" />
        </svg>

        <Card id="placebar" elevation={2} className="hidden">
          <Text className="mono" id="place-hint">
            Click a point to place a region · Esc cancels
          </Text>

          <Button id="place-cancel" size="small">
            Cancel
          </Button>
        </Card>

        <Card id="segbar" elevation={2} className="hidden">
          <Text className="mono" id="seg-hint">
            Click to trace a shape · double-click to close · Esc to cancel
          </Text>

          <Button id="seg-region" intent={Intent.PRIMARY} size="small" disabled>
            Create region
          </Button>

          <Button id="seg-in" size="small" disabled>
            Keep inside now
          </Button>

          <Button id="seg-out" size="small" disabled>
            Remove inside now
          </Button>

          <Button id="seg-cancel" size="small">
            Cancel
          </Button>
        </Card>

        <div id="coord" className="mono hidden" />
        <div id="labels" />

        <div id="modal" className="hidden">
          <Card elevation={4} className="card">
            <H2 id="modal-title" />
            <div id="modal-body" />
            <div className="btns" id="modal-btns" />
          </Card>
        </div>

        <div id="busy" className="hidden">
          <Card elevation={4} className="card">
            <Text id="busy-text">Working…</Text>

            <div className="bar">
              <i id="busy-bar" />
            </div>

            <Button id="busy-stop" fill size="small" className="mt-2.5 hidden">
              Cancel
            </Button>
          </Card>
        </div>

        <div id="err" className="hidden" />
      </div>

      <Dialog
        isOpen={isCompareDialogOpen}
        onClose={() => !isCompareLoading && setIsCompareDialogOpen(false)}
        title="Compare Scans in Tree"
        icon="comparison"
        className={Classes.DARK}
        canOutsideClickClose={!isCompareLoading}
      >
        <DialogBody>
          {scans.length < 2 ? (
            <Callout intent={Intent.WARNING} icon="warning-sign" className="text-xs">
              At least two scans are required in this scan tree to compare. Upload or add another scan to compare.
            </Callout>
          ) : (
            <div className="space-y-4 text-xs">
              <Callout intent={Intent.PRIMARY} icon="info-sign" className="text-xs">
                Compare two scans side-by-side by overlaying one over the other in 3D.
                The <strong>base scan</strong> is rendered with normal colors, and the <strong>comparison scan</strong> is overlaid in light pink with translucency.
              </Callout>

              <div className="rounded-md border border-[#333333] bg-[#181818] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-300">Base Scan:</span>
                </div>
                <div className="font-mono text-sm text-white truncate">
                  {baseScan?.fileName ?? 'Current scan'}
                </div>
                {baseScan?.uploadedAt && (
                  <div className="text-gray-400 text-[11px]">
                    {formatDate(baseScan.uploadedAt)} · {formatBytes(baseScan.fileSize)}
                  </div>
                )}
              </div>

              <FormGroup
                label="Overlay Scan to Compare:"
                helperText="Select another scan from this tree to overlay in light pink."
                className="mb-3"
              >
                <HTMLSelect
                  fill
                  value={compareScanId ?? ''}
                  onChange={(e) => setCompareScanId(e.target.value)}
                  options={availableCompareScans.map((s) => ({
                    value: s.id,
                    label: `${s.fileName} (${formatDate(s.uploadedAt)} - ${formatBytes(s.fileSize)})`,
                  }))}
                />
              </FormGroup>

              <FormGroup
                label={`Overlay Opacity: ${Math.round(compareOpacity * 100)}%`}
                helperText="Adjust transparency for the light pink comparison cloud."
                className="mb-1"
              >
                <Slider
                  min={0.1}
                  max={1.0}
                  stepSize={0.05}
                  labelStepSize={0.2}
                  value={compareOpacity}
                  onChange={setCompareOpacity}
                  labelRenderer={(val) => `${Math.round(val * 100)}%`}
                />
              </FormGroup>

              {compareError && (
                <Callout intent={Intent.DANGER} icon="error" className="text-xs">
                  {compareError}
                </Callout>
              )}

              {isCompareLoading && compareLoadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-gray-400 text-[11px]">
                    <span>Loading comparison cloud...</span>
                    <span>{Math.round(compareLoadProgress * 100)}%</span>
                  </div>
                  <ProgressBar intent={Intent.PRIMARY} value={compareLoadProgress} />
                </div>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button
                text="Cancel"
                onClick={() => setIsCompareDialogOpen(false)}
                disabled={isCompareLoading}
              />
              {scans.length >= 2 && (
                <Button
                  intent={Intent.PRIMARY}
                  icon="comparison"
                  text="Start comparison"
                  loading={isCompareLoading}
                  disabled={!compareScanId || isCompareLoading}
                  onClick={() => void startComparison()}
                />
              )}
            </>
          }
        />
      </Dialog>

      <div
        style={timelineHeight ? { height: timelineHeight } : undefined}
        className={`shrink-0 flex flex-col bg-[#1a1a1a] border-t border-[#2a2a2a] ${
          !viewerTreeId || !visibleWindows.timeline ? 'hidden' : ''
        }`}
      >
        <div
          onMouseDown={startTimelineResize}
          title="Drag to resize Timeline"
          className="h-1.5 shrink-0 cursor-row-resize bg-[#222222] hover:bg-blue-500/70 transition-colors"
        />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ScanTimeline />
        </div>
      </div>
    </div>
  )
}
