import type { ReactNode } from 'react'
import { Alignment, Navbar, NavbarDivider, NavbarGroup } from '@blueprintjs/core'

/** App header with Vision logo (light/dark aware), divider, and brand text. */
export default function Header({ children }: { children?: ReactNode }) {
  return (
    <Navbar className="flex h-16! items-center justify-between px-6 bg-[#1C1C1C]">
      <NavbarGroup className="flex h-full items-center gap-2">
        <img
          src="/Fixed SVGs/Vision black.svg"
          alt="Vision"
          className="h-5 w-auto object-contain dark:hidden"
        />
        <img
          src="/Fixed SVGs/Vision white.svg"
          alt="Vision"
          className="hidden h-5 w-auto object-contain dark:block"
        />
        <NavbarDivider className="mx-0!" />
        <span className="text-h5 text-white/87 tracking-tight">ShipHappens</span>
      </NavbarGroup>
      {children && (
        <NavbarGroup align={Alignment.END} className="flex h-full items-center gap-2">
          {children}
        </NavbarGroup>
      )}
    </Navbar>
  )
}
