import { useSyncExternalStore } from 'react'

export interface RecentScanEntry {
  scanId: string
  treeId: string
  viewedAt: string
}

const RECENT_SCANS_KEY = 'shiphappens:recent-scans'
const MAX_RECENT_SCANS = 10

function readRecentScans(): RecentScanEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_SCANS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is RecentScanEntry =>
        typeof x?.scanId === 'string' &&
        typeof x?.treeId === 'string' &&
        typeof x?.viewedAt === 'string',
    )
  } catch {
    return []
  }
}

function writeRecentScans(entries: RecentScanEntry[]) {
  try {
    localStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(entries))
  } catch {
    // Ignore storage quota / private-mode errors
  }
}

function appendRecentScan(
  current: RecentScanEntry[],
  treeId: string,
  scanId: string,
): RecentScanEntry[] {
  const next = [
    { scanId, treeId, viewedAt: new Date().toISOString() },
    ...current.filter((item) => item.scanId !== scanId),
  ].slice(0, MAX_RECENT_SCANS)
  writeRecentScans(next)
  return next
}

/**
 * Which scan tree is open in the viewer (and which scan of it is on screen), plus which tree the
 * Scans page is browsing. Lives outside React so it survives switching sidebar sections.
 */
interface ScanSessionState {
  /** Tree open in the viewer, driving the timeline. */
  viewerTreeId: string | null
  /** Scan selected on the timeline (the one the viewer should show). */
  selectedScanId: string | null
  /** Tree whose contents the Scans page is showing; null shows the tree list. */
  browseTreeId: string | null
  /** Most recently viewed scans, newest first. */
  recentScans: RecentScanEntry[]
}

let state: ScanSessionState = {
  viewerTreeId: null,
  selectedScanId: null,
  browseTreeId: null,
  recentScans: readRecentScans(),
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

function setState(partial: Partial<ScanSessionState>) {
  state = { ...state, ...partial }

  for (const listener of listeners) {
    listener()
  }
}

export const scanSession = {
  /** Loads a tree into the viewer; optionally jumps straight to one of its scans. */
  openInViewer: (treeId: string, scanId: string | null = null) =>
    setState({
      viewerTreeId: treeId,
      selectedScanId: scanId,
      recentScans: scanId
        ? appendRecentScan(state.recentScans, treeId, scanId)
        : state.recentScans,
    }),
  closeViewerTree: () => setState({ viewerTreeId: null, selectedScanId: null }),
  selectScan: (scanId: string | null) =>
    setState({
      selectedScanId: scanId,
      recentScans:
        scanId && state.viewerTreeId
          ? appendRecentScan(state.recentScans, state.viewerTreeId, scanId)
          : state.recentScans,
    }),
  browse: (treeId: string | null) => setState({ browseTreeId: treeId }),
}

export function useScanSession() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  return { ...snapshot, ...scanSession }
}

