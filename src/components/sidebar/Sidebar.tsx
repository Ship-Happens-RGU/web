import { Classes } from '@blueprintjs/core'
import SidebarButton from './SidebarButton'
import { useSidebar } from './Composables/useSidebar'

export default function Sidebar() {
  const { collapsed, toggleCollapsed, dashboard, scans, viewer, admin } = useSidebar()

  return (
    <aside
      className={`${Classes.DARK} flex h-full shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#1c1c1c] transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      <div
        className={`flex h-16 shrink-0 items-center whitespace-nowrap border-b border-white/10 ${
          collapsed ? 'justify-center px-2' : 'px-5'
        }`}
      >
        {collapsed ? (
          <div className="flex h-6 w-6 shrink-0 items-center justify-start overflow-hidden">
            <img
              src="/Fixed SVGs/Vision white.svg"
              alt="Vision"
              className="block h-6 max-w-none"
            />
          </div>
        ) : (
          <img
            src="/Fixed SVGs/Vision white.svg"
            alt="Vision"
            className="block h-6 w-auto object-contain"
          />
        )}
      </div>

      <nav className="mt-3 flex flex-1 flex-col gap-1.5 overflow-y-auto px-2.5">
        <SidebarButton
          collapsed={collapsed}
          icon="home"
          label="Dashboard"
          active={dashboard.active}
          onClick={dashboard.open}
        />

        <SidebarButton
          collapsed={collapsed}
          icon="folder-close"
          label="Scans"
          active={scans.active}
          onClick={scans.open}
        />

        <SidebarButton
          collapsed={collapsed}
          icon="cube"
          label="Viewer"
          active={viewer.active}
          onClick={viewer.open}
        />
      </nav>

      <div className="flex flex-col gap-1.5 px-2.5 py-3 border-t border-white/5">
        <SidebarButton
          collapsed={collapsed}
          icon="cog"
          label="Admin"
          active={admin.active}
          disabled={admin.disabled}
          onClick={admin.open}
        />

        <SidebarButton
          collapsed={collapsed}
          icon={collapsed ? 'menu-open' : 'menu-closed'}
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleCollapsed}
        />
      </div>
    </aside>
  )
}
