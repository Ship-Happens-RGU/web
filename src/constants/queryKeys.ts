export const QUERY_KEYS = {
  me: ['me'],
  scanTrees: ['scan-trees'],
  scanTree: (id: string) => ['scan-trees', id] as const,
  treeScans: (id: string) => ['scan-trees', id, 'scans'] as const,
} as const
