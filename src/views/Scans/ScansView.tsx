import { useState } from 'react'
import { Button, Card, Classes, Icon, Intent, NonIdealState, Spinner, Tag } from '@blueprintjs/core'
import PageHeader from '@/components/PageHeader'
import { useSidebar } from '@/components/sidebar/Composables/useSidebar'
import { useScanTrees } from '@/composables/ApiWrappers/Scans/useScanTrees'
import { useScanSession } from '@/composables/useScanSession'
import type { ScanTree } from '@/types/models'
import { formatDate } from '@/utils/format'
import CreateScanTreeDialog from './Components/CreateScanTreeDialog'
import ScanTreeDetail from './ScanTreeDetail'

export default function ScansView() {
  const { browseTreeId, browse } = useScanSession()

  if (browseTreeId) {
    return <ScanTreeDetail treeId={browseTreeId} onBack={() => browse(null)} />
  }

  return <ScanTreeList onOpen={(tree) => browse(tree.id)} />
}

function ScanTreeList({ onOpen }: { onOpen: (tree: ScanTree) => void }) {
  const trees = useScanTrees()
  const [creating, setCreating] = useState(false)
  const session = useScanSession()
  const { viewer } = useSidebar()

  const openInViewer = (tree: ScanTree) => {
    session.openInViewer(tree.id)
    viewer.open()
  }

  return (
    <div className={`${Classes.DARK} flex min-w-0 flex-1 flex-col bg-[#111111]`}>
      <PageHeader
        icon="folder-close"
        crumbs={[{ label: 'ShipHappens' }, { label: 'Scans' }]}
        actions={
          <Button intent={Intent.PRIMARY} icon="folder-new" onClick={() => setCreating(true)}>
            New scan tree
          </Button>
        }
      />

      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        {trees.isPending && (
          <div className="flex h-full items-center justify-center">
            <Spinner intent={Intent.PRIMARY} />
          </div>
        )}

        {trees.error && (
          <NonIdealState icon="error" title="Could not load scan trees" description={trees.error.message} />
        )}

        {trees.data && trees.data.length === 0 && (
          <NonIdealState
            icon="folder-open"
            title="No scan trees yet"
            description="Create a scan tree to start collecting scans of an asset over time."
            action={
              <Button intent={Intent.PRIMARY} icon="folder-new" onClick={() => setCreating(true)}>
                New scan tree
              </Button>
            }
          />
        )}

        {trees.data && trees.data.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {trees.data.map((tree) => (
              <Card
                key={tree.id}
                interactive
                elevation={1}
                onClick={() => onOpen(tree)}
                className="flex flex-col gap-3 bg-[#1c1c1c]! p-5!"
              >
                <div className="flex items-start gap-3">
                  <Icon icon="folder-close" size={28} className="shrink-0 text-[#30aedb]" />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-subtitle-1 text-white/87">{tree.name}</div>

                    <div className="line-clamp-2 text-body-2 text-white/60">
                      {tree.description ?? 'No description'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Tag minimal icon="layers">
                    {tree.scanCount === null ? '? scans' : `${tree.scanCount} scan${tree.scanCount === 1 ? '' : 's'}`}
                  </Tag>

                  {tree.firstScanDate && tree.lastScanDate && (
                    <Tag minimal icon="calendar">
                      {formatDate(tree.firstScanDate)}
                      {tree.firstScanDate !== tree.lastScanDate && ` – ${formatDate(tree.lastScanDate)}`}
                    </Tag>
                  )}
                </div>

                <div className="mt-auto flex justify-end">
                  <Button
                    size="small"
                    icon="cube"
                    disabled={!tree.scanCount}
                    onClick={(e) => {
                      e.stopPropagation()
                      openInViewer(tree)
                    }}
                  >
                    Open in viewer
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <CreateScanTreeDialog isOpen={creating} onClose={() => setCreating(false)} onCreated={onOpen} />
    </div>
  )
}

