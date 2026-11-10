import type { ReactNode } from 'react'
import {
  Alignment,
  Breadcrumbs,
  Icon,
  Navbar,
  NavbarGroup,
  type BreadcrumbProps,
  type IconName,
} from '@blueprintjs/core'

export interface Crumb {
  label: string
  onClick?: () => void
}

interface PageHeaderProps {
  icon?: IconName
  crumbs: readonly Crumb[]
  actions?: ReactNode
}

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
    <Navbar className="flex h-16! min-h-16! shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#1c1c1c]! px-6 shadow-none!">
      <NavbarGroup
        align={Alignment.START}
        className="flex h-full min-w-0 items-center gap-3 text-white/87"
      >
        {icon && (
          <Icon icon={icon} size={18} className="shrink-0 text-[#30aedb]" />
        )}

        <Breadcrumbs items={items} className="min-w-0 flex-nowrap!" />
      </NavbarGroup>

      {actions && (
        <NavbarGroup
          align={Alignment.END}
          className="flex h-full shrink-0 items-center gap-2"
        >
          {actions}
        </NavbarGroup>
      )}
    </Navbar>
  )
}
