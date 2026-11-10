import { useState } from 'react'
import {
  Alert,
  Button,
  Callout,
  Classes,
  HTMLTable,
  Intent,
  NonIdealState,
  Spinner,
  Tag,
} from '@blueprintjs/core'
import PageHeader from '@/components/PageHeader'
import { useSidebar } from '@/components/sidebar/Composables/useSidebar'
import { useDeleteScan } from '@/composables/ApiWrappers/Scans/useScanMutations'
import { useScanTree } from '@/composables/ApiWrappers/Scans/useScanTree'
import { useDeleteScanTree } from '@/composables/ApiWrappers/Scans/useScanTreeMutations'
import { useTreeScans } from '@/composables/ApiWrappers/Scans/useTreeScans'
import { useScanSession } from '@/composables/useScanSession'
import type { Scan } from '@/types/models'
import { formatBytes, formatDateTime } from '@/utils/format'
import UploadScanDialog from './Components/UploadScanDialog'

interface ScanTreeDetailProps {
  treeId: string
  onBack: () => void
}

export default function ScanTreeDetail({ treeId, onBack }: ScanTreeDetailProps) {
  const tree = useScanTree(treeId)
  const scans = useTreeScans(treeId)
  const session = useScanSession()
  const { viewer } = useSidebar()
  const deleteScan = useDeleteScan()
  const deleteTree = useDeleteScanTree()
  const [uploading, setUploading] = useState(false)
  const [scanToDelete, setScanToDelete] = useState<Scan | null>(null)
  const [confirmTreeDelete, setConfirmTreeDelete] = useState(false)

  const openInViewer = (scanId: string | null = null) => {
    session.openInViewer(treeId, scanId)
    viewer.open()
  }

  // Newest first in the table; the timeline runs oldest → newest.
  const rows = [...(scans.data ?? [])].reverse()

  return (
    <div className={`${Classes.DARK} flex min-w-0 flex-1 flex-col bg-[#111111]`}>
      <PageHeader
        icon="folder-open"
        crumbs={[{ label: 'ShipHappens' }, { label: 'Scans', onClick: onBack }, { label: tree.data?.name ?? '…' }]}
        actions={
          <>
            <Button icon="arrow-left" variant="minimal" onClick={onBack}>
              Back
            </Button>

            <Button icon="cube" disabled={!scans.data?.length} onClick={() => openInViewer()}>
              Open in viewer
            </Button>

            <Button intent={Intent.PRIMARY} icon="cloud-upload" disabled={!tree.data} onClick={() => setUploading(true)}>
              Upload scan
            </Button>

            <Button
              icon="trash"
              variant="minimal"
              intent={Intent.DANGER}
              title="Delete scan tree"
              onClick={() => setConfirmTreeDelete(true)}
            />
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        {tree.data?.description && <p className="mb-4 text-body-2 text-white/60">{tree.data.description}</p>}

        {(tree.error || scans.error) && (
          <Callout intent={Intent.DANGER} className="mb-4">
            {(tree.error ?? scans.error)?.message}
          </Callout>
        )}

        {scans.isPending && (
          <div className="flex h-40 items-center justify-center">
            <Spinner intent={Intent.PRIMARY} />
          </div>
        )}

        {scans.data && scans.data.length === 0 && (
          <NonIdealState
            icon="cloud-upload"
            title="No scans in this tree"
            description="Upload a point cloud and give it the date it was captured. Each scan becomes a point on the timeline."
            action={
              <Button intent={Intent.PRIMARY} icon="cloud-upload" onClick={() => setUploading(true)}>
                Upload scan
              </Button>
            }
          />
        )}

        {rows.length > 0 && (
          <HTMLTable interactive compact className="w-full">
            <thead>
              <tr>
                <th>Scan date</th>
                <th>Name</th>
                <th>File</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {rows.map((scan, index) => (
                <tr key={scan.id} onDoubleClick={() => openInViewer(scan.id)}>
                  <td className="whitespace-nowrap">
                    {formatDateTime(scan.scanDate)}
                    {index === 0 && (
                      <Tag minimal intent={Intent.PRIMARY} className="ml-2">
                        Latest
                      </Tag>
                    )}
                  </td>
                  <td>
                    <div>{scan.name}</div>
                    {scan.notes && <div className="text-caption text-white/60">{scan.notes}</div>}
                  </td>
                  <td className="font-mono text-caption">{scan.fileName}</td>
                  <td className="whitespace-nowrap">{formatBytes(scan.fileSize)}</td>
                  <td className="whitespace-nowrap text-white/60">
                    {formatDateTime(scan.uploadedAt)}
                    {scan.uploadedBy && <div className="text-caption">{scan.uploadedBy}</div>}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Button size="small" variant="minimal" icon="eye-open" onClick={() => openInViewer(scan.id)}>
                      View
                    </Button>
                    <Button
                      size="small"
                      variant="minimal"
                      intent={Intent.DANGER}
                      icon="trash"
                      title="Delete scan"
                      onClick={() => setScanToDelete(scan)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        )}
      </main>

      {tree.data && (
        <UploadScanDialog tree={tree.data} isOpen={uploading} onClose={() => setUploading(false)} />
      )}

      <Alert
        className={Classes.DARK}
        isOpen={!!scanToDelete}
        intent={Intent.DANGER}
        icon="trash"
        confirmButtonText="Delete scan"
        cancelButtonText="Cancel"
        loading={deleteScan.isPending}
        onCancel={() => setScanToDelete(null)}
        onConfirm={() => {
          if (scanToDelete) {
            deleteScan.mutate(scanToDelete, { onSettled: () => setScanToDelete(null) })
          }
        }}
      >
        <p>
          Delete <b>{scanToDelete?.name}</b> ({scanToDelete && formatDateTime(scanToDelete.scanDate)})? Its file is
          removed from S3 and its row from the Iceberg table.
        </p>
      </Alert>

      <Alert
        className={Classes.DARK}
        isOpen={confirmTreeDelete}
        intent={Intent.DANGER}
        icon="trash"
        confirmButtonText="Delete scan tree"
        cancelButtonText="Cancel"
        loading={deleteTree.isPending}
        onCancel={() => setConfirmTreeDelete(false)}
        onConfirm={() =>
          deleteTree.mutate(treeId, {
            onSuccess: () => {
              if (session.viewerTreeId === treeId) {
                session.closeViewerTree()
              }

              setConfirmTreeDelete(false)
              onBack()
            },
            onError: () => setConfirmTreeDelete(false),
          })
        }
      >
        <p>
          Delete <b>{tree.data?.name}</b> and all {scans.data?.length ?? 0} of its scans? This cannot be undone.
        </p>
      </Alert>
    </div>
  )
}

