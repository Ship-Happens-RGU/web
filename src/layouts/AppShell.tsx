import type { ReactNode } from 'react'
import Sidebar from '@/components/sidebar/Sidebar'

export default function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-svh overflow-hidden bg-[#111111]">
      <Sidebar />

      <div className="flex min-w-0 flex-1">
        {children}
      </div>
    </div>
  )
}
