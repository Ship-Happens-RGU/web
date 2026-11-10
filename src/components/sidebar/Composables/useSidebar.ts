import { useState } from 'react'

export type SidebarSection = 'dashboard' | 'viewer' | 'admin'

/**
 * Sidebar state and navigation actions.
 * Starts collapsed as a narrow dark icon rail and expands to reveal labels.
 */
export function useSidebar(initialSection: SidebarSection = 'dashboard') {
  const [collapsed, setCollapsed] = useState(true)
  const [activeSection, setActiveSection] = useState<SidebarSection>(initialSection)

  return {
    collapsed,
    toggleCollapsed: () => setCollapsed((c) => !c),
    activeSection,
    dashboard: {
      active: activeSection === 'dashboard',
      open: () => setActiveSection('dashboard'),
    },
    viewer: {
      active: activeSection === 'viewer',
      open: () => setActiveSection('viewer'),
    },
    admin: {
      active: activeSection === 'admin',
      disabled: false,
      open: () => setActiveSection('admin'),
    },
  }
}

