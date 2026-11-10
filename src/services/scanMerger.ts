import { getViewerApp } from './scanLoader'

async function waitForLoadComplete(timeoutMs = 120000): Promise<void> {
  const start = performance.now()

  await new Promise((resolve) => setTimeout(resolve, 250))

  while (performance.now() - start < timeoutMs) {
    const errEl = document.getElementById('err')
    if (errEl && !errEl.classList.contains('hidden') && errEl.textContent?.trim()) {
      throw new Error(errEl.textContent.trim())
    }

    const loadingEl = document.getElementById('loading')
    if (!loadingEl || loadingEl.classList.contains('hidden')) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  throw new Error('Loading scan into viewer timed out')
}

export interface MergeProgress {
  step: 'loading' | 'merging' | 'exporting' | 'complete'
  currentFile?: number
  totalFiles?: number
  fileName?: string
  message: string
}

/**
 * Merges multiple E57 point cloud files into a single unified .e57 file.
 */
export async function mergeE57Files(
  files: File[],
  onProgress?: (progress: MergeProgress) => void,
): Promise<File> {
  if (files.length === 0) {
    throw new Error('No files provided to merge')
  }

  if (files.length === 1) {
    return files[0]
  }

  const app = await getViewerApp()

  // 1. Open the first file as the base layer
  onProgress?.({
    step: 'loading',
    currentFile: 1,
    totalFiles: files.length,
    fileName: files[0].name,
    message: `Loading scan 1 of ${files.length}: ${files[0].name}…`,
  })

  await (app as any).openFile(files[0], null, false)
  await waitForLoadComplete()

  // 2. Open each subsequent file with add = true
  for (let i = 1; i < files.length; i++) {
    onProgress?.({
      step: 'loading',
      currentFile: i + 1,
      totalFiles: files.length,
      fileName: files[i].name,
      message: `Loading scan ${i + 1} of ${files.length}: ${files[i].name}…`,
    })

    await (app as any).openFile(files[i], null, true)
    await waitForLoadComplete()
  }

  // 3. Merge all layers into the active layer
  onProgress?.({
    step: 'merging',
    totalFiles: files.length,
    message: `Merging ${files.length} scans into a unified point cloud…`,
  })

  // mergeIntoActive(false) skips confirmation modal
  const mergeResult = await (app as any).mergeIntoActive(false)
  if (!mergeResult) {
    throw new Error('Could not merge the point cloud layers')
  }

  // 4. Export the unified layer as a single E57 file
  onProgress?.({
    step: 'exporting',
    totalFiles: files.length,
    message: 'Encoding unified E57 file with WebAssembly…',
  })

  const exportResult = await (app as any).runExport('e57', 1)

  const baseName = files[0].name.replace(/\.[^.]+$/, '')
  const mergedName = `${baseName}-merged.e57`

  const mergedFile = new File([exportResult.file], mergedName, {
    type: 'application/octet-stream',
    lastModified: Date.now(),
  })

  onProgress?.({
    step: 'complete',
    totalFiles: files.length,
    message: `Merged ${files.length} scans (${(mergedFile.size / (1024 * 1024)).toFixed(1)} MB)`,
  })

  return mergedFile
}

