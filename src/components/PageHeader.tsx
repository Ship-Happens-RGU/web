import type { ReactNode } from 'react'
import { Breadcrumbs, Icon, type BreadcrumbProps, type IconName } from '@blueprintjs/core'

export interface Crumb {
  label: string
  /** Optional click handler for navigating back to an ancestor crumb. */
  onClick?: () => void
}

interface PageHeaderProps {
  /** Shown before the breadcrumbs, e.g. the page's or section's icon. */
  icon?: IconName
  /** Path to the current page, outermost first; the last one is shown as the current page. */
  crumbs: readonly Crumb[]
  /** Optional buttons on the right. */
  actions?: ReactNode
}

/** Slim header at the top of each signed-in page: icon and breadcrumbs, with actions on the right. */
export default function PageHeader({ icon, crumbs, actions }: PageHeaderProps) {
  const items: BreadcrumbProps[] = crumbs.map((crumb, index) => {
    const current = index === crumbs.length - 1

    return {
      text: crumb.label,
      current,
      onClick: !current ? crumb.onClick : undefined,
    }
  })

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#1c1c1c] px-4">
      <div className="flex min-w-0 items-center gap-2 text-white/87">
        {icon && <Icon icon={icon} size={16} className="shrink-0 text-[#30aedb]" />}
        <Breadcrumbs items={items} className="min-w-0 flex-nowrap!" />
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

