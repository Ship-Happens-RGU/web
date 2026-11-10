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
  InputGroup,
  Intent,
  ProgressBar,
  TextArea,
} from '@blueprintjs/core'
import { useUploadScan } from '@/composables/ApiWrappers/Scans/useScanMutations'
import type { Scan, ScanTree } from '@/types/models'
import { formatBytes, toLocalInputValue } from '@/utils/format'

/** Formats the viewer can open. */
export const SCAN_FILE_ACCEPT = '.e57,.ply,.las,.laz,.ptx,.pts,.xyz,.txt,.csv,.asc,.obj,.stl'

interface UploadScanDialogProps {
  tree: ScanTree
  isOpen: boolean
  onClose: () => void
  onUploaded?: (scan: Scan) => void
}

export default function UploadScanDialog({ tree, isOpen, onClose, onUploaded }: UploadScanDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [scanDate, setScanDate] = useState(() => toLocalInputValue(new Date()))
  const [notes, setNotes] = useState('')
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const upload = useUploadScan()

  const reset = () => {
    setFile(null)
    setName('')
    setScanDate(toLocalInputValue(new Date()))
    setNotes('')
    setProgress(0)
    upload.reset()
  }

  const close = () => {
    abortRef.current?.abort()
    reset()
    onClose()
  }

  const pickFile = (picked: File | null) => {
    setFile(picked)

    if (picked) {
      // Default the name from the file and the date from when the file was last written.
      setName((current) => current || picked.name.replace(/\.[^.]+$/, ''))
      setScanDate(toLocalInputValue(new Date(picked.lastModified)))
    }
  }

  const date = new Date(scanDate)
  const valid = !!file && !Number.isNaN(date.getTime())

  const submit = () => {
    if (!valid || !file) {
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setProgress(0)

    upload.mutate(
      {
        treeId: tree.id,
        file,
        scanDate: date,
        name: name.trim() || undefined,
        notes: notes.trim() || undefined,
        onProgress: setProgress,
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

  return (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      title={`Upload scan to ${tree.name}`}
      icon="cloud-upload"
      className={Classes.DARK}
      canOutsideClickClose={!upload.isPending}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <DialogBody>
          <FormGroup label="Scan file" labelInfo="(required)" helperText={file ? formatBytes(file.size) : undefined}>
            <FileInput
              fill
              hasSelection={!!file}
              text={file?.name ?? 'Choose a point cloud…'}
              disabled={upload.isPending}
              inputProps={{ accept: SCAN_FILE_ACCEPT }}
              onInputChange={(e) => pickFile((e.target as HTMLInputElement).files?.[0] ?? null)}
            />
          </FormGroup>

          <FormGroup
            label="Scan date"
            labelFor="scan-date"
            labelInfo="(required)"
            helperText="When the scan was taken — this is where it sits on the timeline."
          >
            <input
              id="scan-date"
              type="datetime-local"
              className={`${Classes.INPUT} ${Classes.FILL}`}
              value={scanDate}
              disabled={upload.isPending}
              onChange={(e) => setScanDate(e.target.value)}
              style={{ colorScheme: 'dark' }}
            />
          </FormGroup>

          <FormGroup label="Name" labelFor="scan-name">
            <InputGroup
              id="scan-name"
              placeholder="Defaults to the file name"
              value={name}
              maxLength={200}
              disabled={upload.isPending}
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
              disabled={upload.isPending}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormGroup>

          {upload.isPending && (
            <div className="flex flex-col gap-1.5">
              <ProgressBar intent={Intent.PRIMARY} value={progress < 1 ? progress : undefined} />
              <span className="text-caption text-white/60">
                {progress < 1
                  ? `Uploading… ${Math.round(progress * 100)}%`
                  : 'Writing to S3 and committing to Iceberg…'}
              </span>
            </div>
          )}

          {upload.error && !cancelled && <Callout intent={Intent.DANGER}>{upload.error.message}</Callout>}
        </DialogBody>

        <DialogFooter
          actions={
            <>
              <Button text={upload.isPending ? 'Cancel upload' : 'Cancel'} onClick={close} />
              <Button
                type="submit"
                intent={Intent.PRIMARY}
                icon="cloud-upload"
                text="Upload"
                disabled={!valid}
                loading={upload.isPending}
              />
            </>
          }
        />
      </form>
    </Dialog>
  )
}

