import type { ReactNode } from 'react'
import { Alignment, Navbar, NavbarDivider, NavbarGroup } from '@blueprintjs/core'
import oceaneeringLogo from '@/assets/oceaneering-logo.png'

/** App header with vertically aligned logo, divider, and brand text. */
export default function Header({ children }: { children?: ReactNode }) {
  return (
    <Navbar className="flex h-16! items-center justify-between px-6 bg-[#181c22] border-b border-slate-800">
      <NavbarGroup className="flex h-full items-center gap-3.5">
        <div className="flex items-center">
          <img
            src={oceaneeringLogo}
            alt="Oceaneering"
            className="block h-7 w-auto object-contain"
          />
        </div>
        <NavbarDivider className="self-center m-0 h-5 border-l border-slate-600" />
        <span className="text-xl font-bold text-white tracking-tight leading-none flex items-center select-none">
          ShipHappens
        </span>
      </NavbarGroup>
      {children && (
        <NavbarGroup align={Alignment.END} className="flex h-full items-center gap-2">
          {children}
        </NavbarGroup>
      )}
    </Navbar>
  )
}
