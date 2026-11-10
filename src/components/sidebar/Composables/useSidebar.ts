import { useSyncExternalStore } from 'react'

export type SidebarSection = 'dashboard' | 'viewer' | 'admin'

interface SidebarStoreState {
  collapsed: boolean
  activeSection: SidebarSection
}

let state: SidebarStoreState = {
  collapsed: true,
  activeSection: 'dashboard',
}

const listeners = new Set<() => void>()

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

function setSidebarState(partial: Partial<SidebarStoreState>) {
  state = { ...state, ...partial }
  emitChange()
}

/**
 * Shared sidebar state and navigation actions across the app shell.
 * Starts collapsed as a narrow dark icon rail and expands to reveal labels.
 */
export function useSidebar() {
  const { collapsed, activeSection } = useSyncExternalStore(subscribe, getSnapshot)

  return {
    collapsed,
    toggleCollapsed: () => setSidebarState({ collapsed: !collapsed }),
    activeSection,
    dashboard: {
      active: activeSection === 'dashboard',
      open: () => setSidebarState({ activeSection: 'dashboard' }),
    },
    viewer: {
      active: activeSection === 'viewer',
      open: () => setSidebarState({ activeSection: 'viewer' }),
    },
    admin: {
      active: activeSection === 'admin',
      disabled: false,
      open: () => setSidebarState({ activeSection: 'admin' }),
    },
  }
}
