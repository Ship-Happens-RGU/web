import type { ReactNode } from 'react'
import Sidebar from '@/components/sidebar/Sidebar'

/**
 * Frame for signed-in pages: the collapsible Vision Brand sidebar on the left
 * and the active page content on the right.
 */
export default function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-svh overflow-hidden bg-[#111111]">
      <Sidebar />
      <div className="flex min-w-0 flex-1">{children}</div>
    </div>
  )
}

