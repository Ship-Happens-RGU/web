/** Shapes of the data the ShipHappens API sends and accepts. */

export interface AuthenticatedUser {
  id: string
  email: string
  displayName: string | null
  mustChangePassword: boolean
}

export interface ApiError {
  error?: string
}

/** A folder of scans. Stats are null when scan storage (Iceberg) is unreachable. */
export interface ScanTree {
  id: string
  name: string
  description: string | null
  createdAt: string
  scanCount: number | null
  firstScanDate: string | null
  lastScanDate: string | null
}

/** One scan stored in the Iceberg scans table; scanDate is the date the user says it was taken. */
export interface Scan {
  id: string
  treeId: string
  name: string
  scanDate: string
  fileName: string
  fileSize: number
  notes: string | null
  uploadedBy: string | null
  uploadedAt: string
  /** The GLB mesh converted from this scan, or null if it has not been converted. */
  model: ScanModelInfo | null
}

/** A triangle-mesh model (GLB) converted from a scan's point cloud. */
export interface ScanModelInfo {
  format: 'glb'
  fileSize: number
  vertexCount: number | null
  triangleCount: number | null
  voxelCm: number | null
  createdAt: string
}
