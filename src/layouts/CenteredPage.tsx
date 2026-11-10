import type { ReactNode } from 'react'
import type { IconName } from '@blueprintjs/core'
import PageHeader, { type Crumb } from '@/components/PageHeader'

interface CenteredPageProps {
  icon?: IconName
  crumbs: readonly Crumb[]
  actions?: ReactNode
  children: ReactNode
}

export default function CenteredPage({
  icon,
  crumbs,
  actions,
  children,
}: CenteredPageProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[#111111]">
      <PageHeader icon={icon} crumbs={crumbs} actions={actions} />

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-[5%]">
        {children}
      </main>
    </div>
  )
}
