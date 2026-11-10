import type { ReactNode } from 'react'
import { Alignment, Navbar, NavbarDivider, NavbarGroup, NavbarHeading } from '@blueprintjs/core'
import oceaneeringLogo from '@/assets/oceaneering-logo.png'

/** App header matching AberWest's Navbar design with Oceaneering branding. */
export default function Header({ children }: { children?: ReactNode }) {
  return (
    <Navbar className="flex h-16! items-center justify-between">
      <NavbarGroup className="flex h-full items-center">
        <img
          src={oceaneeringLogo}
          alt="Oceaneering"
          className="block h-7 w-auto object-contain"
        />
        <NavbarDivider className="self-center mx-4" />
        <NavbarHeading className="m-0! mb-[2px]! text-lg! font-semibold text-white">
          ShipHappens
        </NavbarHeading>
      </NavbarGroup>
      {children && (
        <NavbarGroup align={Alignment.END} className="flex h-full items-center gap-2">
          {children}
        </NavbarGroup>
      )}
    </Navbar>
  )
}
