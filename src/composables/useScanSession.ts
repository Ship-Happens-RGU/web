import { useSyncExternalStore } from 'react'

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
}

let state: ScanSessionState = {
  viewerTreeId: null,
  selectedScanId: null,
  browseTreeId: null,
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
    setState({ viewerTreeId: treeId, selectedScanId: scanId }),
  closeViewerTree: () => setState({ viewerTreeId: null, selectedScanId: null }),
  selectScan: (scanId: string | null) => setState({ selectedScanId: scanId }),
  browse: (treeId: string | null) => setState({ browseTreeId: treeId }),
}

export function useScanSession() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  return { ...snapshot, ...scanSession }
}

