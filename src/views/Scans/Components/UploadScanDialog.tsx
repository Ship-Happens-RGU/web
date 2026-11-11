import { useRef, useState } from 'react'
import {
  Button,
  Callout,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  FileInput,
  FormGroup,
  Icon,
  InputGroup,
  Intent,
  ProgressBar,
  Tag,
  TextArea,
} from '@blueprintjs/core'
import { useUploadScan } from '@/composables/ApiWrappers/Scans/useScanMutations'
import type { ServerUploadProgress } from '@/services/api'
import { mergeE57Files, type MergeProgress } from '@/services/scanMerger'
import type { Scan, ScanTree } from '@/types/models'
import { formatBytes, toLocalInputValue } from '@/utils/format'

/** Formats the viewer can open. */
export const SCAN_FILE_ACCEPT = '.e57'

interface UploadScanDialogProps {
  tree: ScanTree
  isOpen: boolean
  onClose: () => void
  onUploaded?: (scan: Scan) => void
}

export default function UploadScanDialog({ tree, isOpen, onClose, onUploaded }: UploadScanDialogProps) {
  const [files, setFiles] = useState<File[]>([])
  const [name, setName] = useState('')
  const [scanDate, setScanDate] = useState(() => toLocalInputValue(new Date()))
  const [notes, setNotes] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [serverProgress, setServerProgress] = useState<ServerUploadProgress | null>(null)
  const [mergeProgress, setMergeProgress] = useState<MergeProgress | null>(null)
  const [isMerging, setIsMerging] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const upload = useUploadScan()

  const reset = () => {
    setFiles([])
    setName('')
    setScanDate(toLocalInputValue(new Date()))
    setNotes('')
    setUploadProgress(0)
    setServerProgress(null)
    setMergeProgress(null)
    setIsMerging(false)
    setMergeError(null)
    upload.reset()
  }

  const close = () => {
    abortRef.current?.abort()
    reset()
    onClose()
  }

  const handlePickFiles = (pickedList: FileList | null) => {
    if (!pickedList || pickedList.length === 0) {
      return
    }

    const picked = Array.from(pickedList)
    setFiles((prev) => {
      // Append unique files
      const existingNames = new Set(prev.map((f) => f.name))
      const combined = [...prev, ...picked.filter((f) => !existingNames.has(f.name))]

      if (combined.length === 1) {
        setName((curr) => curr || combined[0].name.replace(/\.[^.]+$/, ''))
        setScanDate(toLocalInputValue(new Date(combined[0].lastModified)))
      } else if (combined.length > 1) {
        const base = combined[0].name.replace(/\.[^.]+$/, '')
        setName((curr) => curr || `${base}-merged`)
        setScanDate(toLocalInputValue(new Date(combined[0].lastModified)))
      }

      return combined
    })
  }

  const removeFile = (indexToRemove: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove)
      if (updated.length === 1) {
        setName(updated[0].name.replace(/\.[^.]+$/, ''))
      } else if (updated.length === 0) {
        setName('')
      }
      return updated
    })
  }

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0)
  const date = new Date(scanDate)
  const isMultiple = files.length > 1
  const isBusy = upload.isPending || isMerging
  const valid = files.length > 0 && !Number.isNaN(date.getTime())

  const submit = async () => {
    if (!valid || files.length === 0) {
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setUploadProgress(0)
    setMergeError(null)

    let fileToUpload: File = files[0]

    // If multiple files are selected, merge them first
    if (isMultiple) {
      setIsMerging(true)
      try {
        fileToUpload = await mergeE57Files(files, (progress) => {
          setMergeProgress(progress)
        })
      } catch (err: unknown) {
        setIsMerging(false)
        setMergeError((err as Error)?.message || 'Failed to merge scan files')
        return
      } finally {
        setIsMerging(false)
      }
    }

    // Upload the final file to Apache Iceberg on S3
    upload.mutate(
      {
        treeId: tree.id,
        file: fileToUpload,
        scanDate: date,
        name: name.trim() || undefined,
        notes: notes.trim() || undefined,
        onProgress: (fraction) => {
          setUploadProgress(fraction)
          if (fraction >= 1) {
            setServerProgress((prev) => prev ?? { phase: 'processing', message: 'Processing scan...', progress: 0.05 })
          }
        },
        onServerProgress: (progress) => {
          setServerProgress(progress)
        },
        signal: controller.signal,
      },
      {
        onSuccess: (scan) => {
          reset()
          onClose()
          onUploaded?.(scan)
        },
      },
    )
  }

  const cancelled = upload.error?.name === 'AbortError'
  const fileInputText =
    files.length === 0
      ? 'Choose one or multiple point clouds…'
      : files.length === 1
        ? files[0].name
        : `${files.length} scans selected to merge (${formatBytes(totalBytes)})`

  return (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      title={`Upload scan to ${tree.name}`}
      icon="cloud-upload"
      className={Classes.DARK}
      canOutsideClickClose={!isBusy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <DialogBody>
          {/* User notification: You can upload multiple scans at once to merge them */}
          <Callout intent={Intent.PRIMARY} icon="merge-columns" className="mb-4 text-xs">
            <strong>Multi-scan merge:</strong> You can select multiple <code>.e57</code> files at once.
            They will be automatically merged into a single scan before uploading to the scan tree.
          </Callout>

          {/* File Picker with multiple selection */}
          <FormGroup
            label="Scan file(s)"
            labelInfo="(required)"
            helperText={files.length > 0 ? `Total size: ${formatBytes(totalBytes)}` : 'Select one or more scan files (.e57, .ply, .las, etc.)'}
          >
            <FileInput
              fill
              hasSelection={files.length > 0}
              text={fileInputText}
              disabled={isBusy}
              inputProps={{ accept: SCAN_FILE_ACCEPT, multiple: true }}
              onInputChange={(e) => handlePickFiles((e.target as HTMLInputElement).files)}
            />
          </FormGroup>

          {/* Multiple files preview & merge summary */}
          {isMultiple && (
            <div className="mb-4 rounded border border-white/10 bg-[#161616] p-3 text-xs">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium text-white/90">
                  <Icon icon="merge-columns" size={13} className="text-[#30aedb]" />
                  <span>{files.length} scans will be merged into 1 E57 file</span>
                </div>
                <Tag minimal intent={Intent.PRIMARY}>
                  {formatBytes(totalBytes)}
                </Tag>
              </div>

              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between rounded bg-[#222222] px-2 py-1 text-[11px]"
                  >
                    <span className="truncate max-w-[280px] font-mono text-white/80">{f.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">{formatBytes(f.size)}</span>
                      {!isBusy && (
                        <Button
                          icon="cross"
                          variant="minimal"
                          small
                          onClick={() => removeFile(idx)}
                          title="Remove file from merge list"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <FormGroup
            label="Scan date"
            labelFor="scan-date"
            labelInfo="(required)"
            helperText="When the scan was taken — this places it on the timeline."
          >
            <input
              id="scan-date"
              type="datetime-local"
              className={`${Classes.INPUT} ${Classes.FILL}`}
              value={scanDate}
              disabled={isBusy}
              onChange={(e) => setScanDate(e.target.value)}
              style={{ colorScheme: 'dark' }}
            />
          </FormGroup>

          <FormGroup
            label={isMultiple ? 'Merged scan name' : 'Name'}
            labelFor="scan-name"
            helperText={isMultiple ? 'Name of the unified scan created from the merged files' : undefined}
          >
            <InputGroup
              id="scan-name"
              placeholder={isMultiple ? 'e.g. Platform_Full_Merged' : 'Defaults to the file name'}
              value={name}
              maxLength={200}
              disabled={isBusy}
              onChange={(e) => setName(e.target.value)}
            />
          </FormGroup>

          <FormGroup label="Notes" labelFor="scan-notes">
            <TextArea
              id="scan-notes"
              fill
              rows={2}
              maxLength={2000}
              value={notes}
              disabled={isBusy}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormGroup>

          {/* Merge & upload progress bar */}
          {isMerging && mergeProgress && (
            <div className="flex flex-col gap-1.5 my-2">
              <ProgressBar intent={Intent.PRIMARY} animate stripes className="h-1.5!" />
              <div className="flex items-center justify-between text-caption text-[#30aedb]">
                <span>{mergeProgress.message}</span>
                {mergeProgress.currentFile && mergeProgress.totalFiles && (
                  <span>
                    {mergeProgress.currentFile}/{mergeProgress.totalFiles}
                  </span>
                )}
              </div>
            </div>
          )}

          {upload.isPending && (
            <div className="flex flex-col gap-1.5 my-3 rounded border border-white/10 bg-[#161616] p-2.5">
              {uploadProgress < 1 ? (
                // Phase 1: Upload from browser to Java server
                <>
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-medium text-white/90">Step 1: Uploading to server</span>
                    <span className="text-[#30aedb] font-mono">{Math.round(uploadProgress * 100)}%</span>
                  </div>
                  <ProgressBar intent={Intent.PRIMARY} value={uploadProgress} className="h-1.5!" />
                  <span className="text-caption text-white/60">
                    Uploading to cloud {Math.round(uploadProgress * 100)}%
                  </span>
                </>
              ) : (
                // Phase 2: Loading bar restarts once fully uploaded to Java
                <>
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-medium text-white/90">
                      Step 2:{' '}
                      {serverProgress?.phase === 'iceberg_commit'
                        ? 'Committing to Iceberg'
                        : serverProgress?.phase === 's3_upload'
                          ? 'Uploading to S3'
                          : 'Java Processing'}
                    </span>
                    <span className="text-[#30aedb] font-mono">
                      {Math.round((serverProgress?.progress ?? 0.05) * 100)}%
                    </span>
                  </div>
                  <ProgressBar
                    intent={Intent.PRIMARY}
                    value={serverProgress?.progress ?? 0.05}
                    animate={serverProgress?.phase === 'processing' || serverProgress?.phase === 'iceberg_commit'}
                    stripes={serverProgress?.phase === 'processing' || serverProgress?.phase === 'iceberg_commit'}
                    className="h-1.5!"
                  />
                  <div className="flex items-center justify-between text-caption text-white/60">
                    <span>
                      {serverProgress?.phase === 's3_upload'
                        ? `Uploading from Java to S3 storage… ${Math.round(serverProgress.progress * 100)}%`
                        : serverProgress?.phase === 'iceberg_commit'
                          ? 'Committing metadata to Apache Iceberg…'
                          : serverProgress?.message ?? 'Processing scan in Java…'}
                    </span>
                    {serverProgress?.written && serverProgress?.total ? (
                      <span className="font-mono text-white/40">
                        {formatBytes(serverProgress.written)} / {formatBytes(serverProgress.total)}
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )}

          {mergeError && <Callout intent={Intent.DANGER} className="my-2">{mergeError}</Callout>}
          {upload.error && !cancelled && <Callout intent={Intent.DANGER} className="my-2">{upload.error.message}</Callout>}
        </DialogBody>

        <DialogFooter
          actions={
            <>
              <Button text={isBusy ? 'Cancel' : 'Cancel'} onClick={close} />
              <Button
                type="submit"
                intent={Intent.PRIMARY}
                icon={isMultiple ? 'merge-columns' : 'cloud-upload'}
                text={isMultiple ? 'Merge & Upload' : 'Upload'}
                disabled={!valid}
                loading={isBusy}
              />
            </>
          }
        />
      </form>
    </Dialog>
  )
}
