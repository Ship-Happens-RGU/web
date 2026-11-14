import { useCallback, useEffect, useMemo, useState } from 'react'
import { XMLParser } from 'fast-xml-parser'
import { Button, InputGroup, Intent, Spinner, Tag } from '@blueprintjs/core'

async function readE57XmlFromFile(file: File): Promise<{
  xml: string
  header: {
    signature: string
    major: number
    minor: number
    fileLength: number
    xmlPhysicalOffset: number
    xmlLogicalLength: number
    pageSize: number
  }
}> {
  const hdrBuf = await file.slice(0, 48).arrayBuffer()
  const dv = new DataView(hdrBuf)
  const sigBytes = new Uint8Array(hdrBuf, 0, 8)
  const signature = new TextDecoder().decode(sigBytes)
  if (signature !== 'ASTM-E57') {
    throw new Error(`Not a valid .e57 header (signature: "${signature}")`)
  }

  const major = dv.getUint32(8, true)
  const minor = dv.getUint32(12, true)
  const fileLength = Number(dv.getBigUint64(16, true))
  const xmlPhysicalOffset = Number(dv.getBigUint64(24, true))
  const xmlLogicalLength = Number(dv.getBigUint64(32, true))
  const pageSize = Number(dv.getBigUint64(40, true)) || 1024
  const payloadSize = pageSize - 4

  // Read only the paged XML section (no point data is read)
  const pageOffset = xmlPhysicalOffset % pageSize
  const startPagePhys = xmlPhysicalOffset - pageOffset
  const totalBytesNeeded = pageOffset + xmlLogicalLength
  const numPages = Math.ceil(totalBytesNeeded / payloadSize)
  const physBytesToRead = numPages * pageSize

  const rawBuf = await file
    .slice(startPagePhys, startPagePhys + physBytesToRead)
    .arrayBuffer()
  const rawU8 = new Uint8Array(rawBuf)
  const xmlBytes = new Uint8Array(xmlLogicalLength)

  let outPos = 0
  let srcPageStart = 0
  let firstOffset = pageOffset
  while (outPos < xmlLogicalLength && srcPageStart < rawU8.length) {
    const avail = Math.min(
      payloadSize - firstOffset,
      xmlLogicalLength - outPos,
      rawU8.length - (srcPageStart + firstOffset),
    )
    if (avail <= 0) break
    xmlBytes.set(
      rawU8.subarray(srcPageStart + firstOffset, srcPageStart + firstOffset + avail),
      outPos,
    )
    outPos += avail
    srcPageStart += pageSize
    firstOffset = 0
  }

  const xml = new TextDecoder('utf-8').decode(xmlBytes)
  return {
    xml,
    header: {
      signature,
      major,
      minor,
      fileLength,
      xmlPhysicalOffset,
      xmlLogicalLength,
      pageSize,
    },
  }
}

function XmlTreeNode({
  name,
  value,
  search,
  depth = 0,
}: {
  name: string
  value: any
  search: string
  depth?: number
}) {
  const [open, setOpen] = useState(depth < 2)
  const isObject = value !== null && typeof value === 'object'

  const matchesSearch = useMemo(() => {
    if (!search) return true
    const q = search.toLowerCase()
    if (name.toLowerCase().includes(q)) return true
    if (!isObject) return String(value).toLowerCase().includes(q)
    try {
      return JSON.stringify(value).toLowerCase().includes(q)
    } catch {
      return true
    }
  }, [name, value, search, isObject])

  if (!matchesSearch) return null

  if (!isObject) {
    return (
      <div className="flex items-baseline gap-2 py-0.5 pl-4 font-mono text-xs border-l border-[#2a2a2a]">
        <span className="text-sky-300 shrink-0">{name}:</span>
        <span className="text-emerald-300 break-all">{String(value)}</span>
      </div>
    )
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [`[${i}]`, v] as [string, any])
    : Object.entries(value)

  return (
    <div className="pl-3 border-l border-[#2a2a2a]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 py-0.5 text-left font-mono text-xs text-gray-200 hover:text-white cursor-pointer"
      >
        <span className="text-gray-500 w-3 inline-block">
          {open ? '▾' : '▸'}
        </span>
        <span className="text-amber-300 font-semibold">{name}</span>
        <span className="text-[10px] text-gray-500">
          {Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      {open && (
        <div className="ml-1">
          {entries.map(([k, v]) => (
            <XmlTreeNode
              key={k}
              name={k}
              value={v}
              search={search}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function E57XmlTreeOverlay() {
  const [parsedTree, setParsedTree] = useState<any>(null)
  const [rawXml, setRawXml] = useState<string>('')
  const [headerInfo, setHeaderInfo] = useState<string>('')
  const [viewRaw, setViewRaw] = useState(false)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFromFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)
    try {
      const { xml, header } = await readE57XmlFromFile(file)
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
      })
      const tree = parser.parse(xml)
      setRawXml(xml)
      setParsedTree(tree)
      setHeaderInfo(
        `${file.name} · E57 v${header.major}.${header.minor} · XML ${(header.xmlLogicalLength / 1024).toFixed(1)} KB at offset ${header.xmlPhysicalOffset.toLocaleString()} (0 point bytes read)`,
      )
    } catch (err) {
      setError((err as Error)?.message || 'Failed to parse E57 XML section')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const app = (window as unknown as { __app?: any }).__app
    const file: File | null = app?.currentFile ?? null
    if (file && file.name.toLowerCase().endsWith('.e57')) {
      void loadFromFile(file)
    } else if (app?.meta) {
      setParsedTree({ e57Metadata: app.meta })
      setRawXml(JSON.stringify(app.meta, null, 2))
      setHeaderInfo(
        'Showing parsed E57 metadata (open a local .e57 file to inspect raw XML section)',
      )
    } else {
      setError('No .e57 file loaded. Pick an .e57 file below to inspect its XML header without loading points.')
    }
  }, [loadFromFile])

  return (
    <div className="absolute inset-0 top-12 z-[9] bg-[#111111] flex flex-col pt-14 px-6 pb-6 overflow-hidden">
      <div className="max-w-5xl w-full mx-auto flex flex-col h-full rounded-xl border border-[#2a2a2a] bg-[#181818] shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-[#2a2a2a] bg-[#1e1e1e]">
          <div className="flex items-center gap-2">
            <Tag intent={Intent.PRIMARY} minimal>
              XML / Metadata Tree
            </Tag>
            <span className="text-xs text-gray-400">{headerInfo}</span>
          </div>

          <div className="flex items-center gap-2">
            <InputGroup
              small
              leftIcon="search"
              placeholder="Filter keys or values…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-52"
            />
            <Button
              small
              active={viewRaw}
              onClick={() => setViewRaw((v) => !v)}
            >
              {viewRaw ? 'Tree view' : 'Raw XML'}
            </Button>
            <label className="bp6-button bp6-small cursor-pointer">
              Inspect .e57 file…
              <input
                type="file"
                accept=".e57"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void loadFromFile(f)
                }}
              />
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <Spinner size={16} />
              <span>Reading E57 XML header…</span>
            </div>
          )}
          {error && <p className="text-xs text-amber-400">{error}</p>}
          {!isLoading && !error && parsedTree && !viewRaw && (
            <div className="space-y-1">
              {Object.entries(parsedTree).map(([k, v]) => (
                <XmlTreeNode key={k} name={k} value={v} search={search} />
              ))}
            </div>
          )}
          {!isLoading && !error && viewRaw && (
            <pre className="text-xs font-mono text-gray-200 whitespace-pre-wrap break-all">
              {rawXml}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
