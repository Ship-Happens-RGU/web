import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  Button,
  Card,
  Classes,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  Tag,
} from '@blueprintjs/core'
import PageHeader from '@/components/PageHeader'
import { useSidebar } from '@/components/sidebar/Composables/useSidebar'
import { useLogout } from '@/composables/ApiWrappers/Auth/useLogout'
import { useMe } from '@/composables/ApiWrappers/Auth/useMe'
import { useScanTrees } from '@/composables/ApiWrappers/Scans/useScanTrees'
import { useScanSession } from '@/composables/useScanSession'
import { QUERY_KEYS } from '@/constants/queryKeys'
import AppShell from '@/layouts/AppShell'
import { getJson } from '@/services/api'
import type { Scan, ScanTree } from '@/types/models'
import { formatBytes, formatDate, formatDateTime } from '@/utils/format'
import ScansView from '@/views/Scans/ScansView'
import ViewerView from '@/views/Viewer/ViewerView'

export default function Dashboard() {
  const user = useMe().data
  const logout = useLogout()
  const { activeSection, viewer, scans: scansNav } = useSidebar()
  const { recentScans, openInViewer } = useScanSession()
  const treesQuery = useScanTrees()
  const [search, setSearch] = useState('')

  const trees = useMemo(() => treesQuery.data ?? [], [treesQuery.data])

  const treeScanQueries = useQueries({
    queries: trees.map((tree) => ({
      queryKey: QUERY_KEYS.treeScans(tree.id),
      queryFn: () => getJson<Scan[]>(`/api/v1/scan-trees/${tree.id}/scans`),
    })),
  })

  const treesById = useMemo(() => {
    const map = new Map<string, ScanTree>()
    for (const tree of trees) {
      map.set(tree.id, tree)
    }
    return map
  }, [trees])

  const allScans = useMemo(() => {
    const list: Scan[] = []
    for (const q of treeScanQueries) {
      if (q.data) {
        list.push(...q.data)
      }
    }
    return list.sort(
      (a, b) => new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime(),
    )
  }, [treeScanQueries])

  const scansById = useMemo(() => {
    const map = new Map<string, Scan>()
    for (const scan of allScans) {
      map.set(scan.id, scan)
    }
    return map
  }, [allScans])

  const resolvedRecentScans = useMemo(() => {
    return recentScans
      .map((entry) => {
        const scan = scansById.get(entry.scanId)
        if (!scan) return null
        return {
          scan,
          tree: treesById.get(scan.treeId),
          viewedAt: entry.viewedAt,
        }
      })
      .filter((item): item is { scan: Scan; tree: ScanTree | undefined; viewedAt: string } => item !== null)
  }, [recentScans, scansById, treesById])

  const filteredScans = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allScans
    return allScans.filter((scan) => {
      const treeName = treesById.get(scan.treeId)?.name ?? ''
      return (
        scan.name.toLowerCase().includes(q) ||
        scan.fileName.toLowerCase().includes(q) ||
        treeName.toLowerCase().includes(q)
      )
    })
  }, [allScans, search, treesById])

  const isLoadingScans =
    treesQuery.isPending || treeScanQueries.some((q) => q.isPending)

  const totalScanCount = useMemo(() => {
    if (allScans.length > 0 || !isLoadingScans) {
      return allScans.length
    }
    return trees.reduce((sum, t) => sum + (t.scanCount ?? 0), 0)
  }, [allScans.length, isLoadingScans, trees])

  const totalStorageBytes = useMemo(
    () => allScans.reduce((sum, s) => sum + s.fileSize, 0),
    [allScans],
  )

  const handleOpenScan = (scan: Scan) => {
    openInViewer(scan.treeId, scan.id)
    viewer.open()
  }

  if (!user) {
    return null
  }

  return (
    <AppShell>
      <ViewerView active={activeSection === 'viewer'} />

      {activeSection === 'scans' && <ScansView />}

      {activeSection !== 'viewer' && activeSection !== 'scans' && (
        <div className={`${Classes.DARK} flex min-w-0 flex-1 flex-col bg-[#111111]`}>
          <PageHeader
            icon="home"
            crumbs={[{ label: 'ShipHappens' }, { label: 'Dashboard' }]}
            actions={
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/60">
                  {user.displayName ? `${user.displayName} (${user.email})` : user.email}
                </span>
                <Button
                  size="small"
                  intent={Intent.DANGER}
                  variant="minimal"
                  icon="log-out"
                  loading={logout.isPending}
                  onClick={() => logout.mutate()}
                >
                  Log out
                </Button>
              </div>
            }
          />

          <main className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card elevation={1} className="bg-[#1c1c1c]! p-4!">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Total Scans</span>
                  <Icon icon="scatter-plot" size={14} className="text-[#30aedb]" />
                </div>
                {isLoadingScans && allScans.length === 0 ? (
                  <>
                    <div className={`mt-2 h-8 w-16 rounded ${Classes.SKELETON}`} />
                    <div className={`mt-1.5 h-3.5 w-28 rounded ${Classes.SKELETON}`} />
                  </>
                ) : (
                  <>
                    <div className="mt-2 text-2xl font-semibold text-white/90">
                      {totalScanCount}
                    </div>
                    <div className="mt-1 text-[11px] text-white/45">
                      Across {trees.length} scan {trees.length === 1 ? 'tree' : 'trees'}
                    </div>
                  </>
                )}
              </Card>

              <Card elevation={1} className="bg-[#1c1c1c]! p-4!">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Scan Trees</span>
                  <Icon icon="folder-close" size={14} className="text-[#30aedb]" />
                </div>
                {treesQuery.isPending ? (
                  <>
                    <div className={`mt-2 h-8 w-14 rounded ${Classes.SKELETON}`} />
                    <div className={`mt-1.5 h-3.5 w-24 rounded ${Classes.SKELETON}`} />
                  </>
                ) : (
                  <>
                    <div className="mt-2 text-2xl font-semibold text-white/90">
                      {trees.length}
                    </div>
                    <div className="mt-1 text-[11px] text-white/45">
                      Asset collections
                    </div>
                  </>
                )}
              </Card>

              <Card elevation={1} className="bg-[#1c1c1c]! p-4!">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Recently Viewed</span>
                  <Icon icon="history" size={14} className="text-[#30aedb]" />
                </div>
                {isLoadingScans && recentScans.length > 0 && resolvedRecentScans.length === 0 ? (
                  <>
                    <div className={`mt-2 h-8 w-14 rounded ${Classes.SKELETON}`} />
                    <div className={`mt-1.5 h-3.5 w-32 rounded ${Classes.SKELETON}`} />
                  </>
                ) : (
                  <>
                    <div className="mt-2 text-2xl font-semibold text-white/90">
                      {resolvedRecentScans.length}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-white/45">
                      {resolvedRecentScans[0]
                        ? `Last: ${resolvedRecentScans[0].scan.name}`
                        : 'No scans viewed yet'}
                    </div>
                  </>
                )}
              </Card>

              <Card elevation={1} className="bg-[#1c1c1c]! p-4!">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Total Storage</span>
                  <Icon icon="database" size={14} className="text-[#30aedb]" />
                </div>
                {isLoadingScans && allScans.length === 0 ? (
                  <>
                    <div className={`mt-2 h-8 w-24 rounded ${Classes.SKELETON}`} />
                    <div className={`mt-1.5 h-3.5 w-32 rounded ${Classes.SKELETON}`} />
                  </>
                ) : (
                  <>
                    <div className="mt-2 text-2xl font-semibold text-white/90">
                      {formatBytes(totalStorageBytes)}
                    </div>
                    <div className="mt-1 text-[11px] text-white/45">
                      Point cloud &amp; scan data
                    </div>
                  </>
                )}
              </Card>
            </div>

            {/* Most Recently Viewed Scans */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon="history" size={15} className="text-[#30aedb]" />
                  <h2 className="text-sm font-semibold text-white/90">
                    Recently Viewed Scans
                  </h2>
                </div>
              </div>

              {isLoadingScans && recentScans.length > 0 && resolvedRecentScans.length === 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <Card key={i} elevation={1} className="flex flex-col gap-3 bg-[#1c1c1c]! p-4!">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className={`h-4 w-3/4 rounded ${Classes.SKELETON}`} />
                          <div className={`h-3 w-1/2 rounded ${Classes.SKELETON}`} />
                        </div>
                        <div className={`h-4 w-10 rounded ${Classes.SKELETON}`} />
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-2">
                        <div className={`h-3 w-24 rounded ${Classes.SKELETON}`} />
                        <div className={`h-3 w-14 rounded ${Classes.SKELETON}`} />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : resolvedRecentScans.length === 0 ? (
                <Card elevation={1} className="bg-[#1c1c1c]! p-4! text-xs text-white/55">
                  You haven&apos;t viewed any scans yet. Select a scan below to open it in the 3D viewer.
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {resolvedRecentScans.slice(0, 8).map(({ scan, tree, viewedAt }) => (
                    <Card
                      key={scan.id}
                      interactive
                      elevation={1}
                      onClick={() => handleOpenScan(scan)}
                      className="flex flex-col justify-between gap-2.5 bg-[#1c1c1c]! p-4!"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white/90">
                            {scan.name}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-white/50">
                            {tree?.name ?? 'Scan Tree'} · {scan.fileName}
                          </div>
                        </div>
                        <Tag minimal intent={Intent.PRIMARY} className="shrink-0 font-mono text-[10px]">
                          {scan.fileName.split('.').pop()?.toUpperCase() ?? 'SCAN'}
                        </Tag>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-white/50">
                        <span>Viewed {formatDateTime(viewedAt)}</span>
                        <span>{formatBytes(scan.fileSize)}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* All Scans List */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon icon="layers" size={15} className="text-[#30aedb]" />
                  <h2 className="text-sm font-semibold text-white/90">
                    All Scans
                  </h2>
                  <Tag minimal intent={Intent.NONE}>
                    {filteredScans.length}
                  </Tag>
                </div>

                <div className="flex items-center gap-2">
                  <InputGroup
                    leftIcon="search"
                    placeholder="Filter scans…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    small
                    className="w-56"
                  />
                  <Button
                    size="small"
                    icon="folder-open"
                    onClick={() => scansNav.open()}
                  >
                    Manage Scan Trees
                  </Button>
                </div>
              </div>

              {isLoadingScans && allScans.length === 0 ? (
                <Card elevation={1} className="overflow-hidden bg-[#1c1c1c]! p-0!">
                  <div className="divide-y divide-white/5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className={`h-4 w-4 shrink-0 rounded ${Classes.SKELETON}`} />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className={`h-4 w-44 rounded ${Classes.SKELETON}`} />
                              <div className={`h-4 w-20 rounded ${Classes.SKELETON}`} />
                            </div>
                            <div className={`h-3 w-64 rounded ${Classes.SKELETON}`} />
                          </div>
                        </div>
                        <div className={`h-6 w-14 shrink-0 rounded ${Classes.SKELETON}`} />
                      </div>
                    ))}
                  </div>
                </Card>
              ) : treesQuery.error ? (
                <NonIdealState
                  icon="error"
                  title="Could not load scans"
                  description={treesQuery.error.message}
                />
              ) : filteredScans.length === 0 ? (
                <NonIdealState
                  icon="scatter-plot"
                  title={allScans.length === 0 ? 'No scans yet' : 'No matching scans'}
                  description={
                    allScans.length === 0
                      ? 'Upload a scan in a scan tree to see it here.'
                      : 'Try a different search filter.'
                  }
                  action={
                    allScans.length === 0 ? (
                      <Button
                        intent={Intent.PRIMARY}
                        icon="folder-open"
                        onClick={() => scansNav.open()}
                      >
                        Go to Scans
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <Card elevation={1} className="overflow-hidden bg-[#1c1c1c]! p-0!">
                  <div className="divide-y divide-white/5">
                    {filteredScans.map((scan) => {
                      const tree = treesById.get(scan.treeId)
                      return (
                        <div
                          key={scan.id}
                          onClick={() => handleOpenScan(scan)}
                          className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-white/5"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Icon
                              icon="scatter-plot"
                              size={16}
                              className="shrink-0 text-[#30aedb]"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-white/90">
                                  {scan.name}
                                </span>
                                {tree && (
                                  <Tag minimal className="shrink-0 text-[10px]">
                                    {tree.name}
                                  </Tag>
                                )}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-white/50">
                                {scan.fileName} · {formatBytes(scan.fileSize)} · Scan date {formatDate(scan.scanDate)}
                              </div>
                            </div>
                          </div>

                          <Button
                            size="small"
                            minimal
                            intent={Intent.PRIMARY}
                            icon="eye-open"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenScan(scan)
                            }}
                          >
                            View
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}
            </section>
          </main>
        </div>
      )}
    </AppShell>
  )
}
