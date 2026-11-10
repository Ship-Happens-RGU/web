import { Classes } from '@blueprintjs/core'
import SidebarButton from './SidebarButton'
import { useSidebar } from './Composables/useSidebar'

export default function Sidebar() {
  const { collapsed, toggleCollapsed, dashboard, viewer, admin } = useSidebar()

  return (
    <aside
      className={`${Classes.DARK} flex h-full shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#1c1c1c] py-2 transition-[width] duration-200 ${
        collapsed ? 'w-12' : 'w-52'
      }`}
    >
      <div
        className={`flex h-10 shrink-0 items-center whitespace-nowrap px-2 ${
          collapsed ? 'justify-center' : 'px-4'
        }`}
      >
        {collapsed ? (
          <div className="h-5 w-5 shrink-0 overflow-hidden">
            <img
              src="/Fixed SVGs/Vision white.svg"
              alt="Vision"
              className="block h-5 max-w-none"
            />
          </div>
        ) : (
          <img
            src="/Fixed SVGs/Vision white.svg"
            alt="Vision"
            className="block h-5 w-auto object-contain"
          />
        )}
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 overflow-y-auto px-2">
        <SidebarButton
          collapsed={collapsed}
          icon="home"
          label="Dashboard"
          active={dashboard.active}
          onClick={dashboard.open}
        />

        <SidebarButton
          collapsed={collapsed}
          icon="cube"
          label="Viewer"
          active={viewer.active}
          onClick={viewer.open}
        />
      </nav>

      <div className="flex flex-col gap-1 px-2">
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
