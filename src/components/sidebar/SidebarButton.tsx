import { Alignment, Button, Tooltip, type IconName } from '@blueprintjs/core'

interface SidebarButtonProps {
  collapsed: boolean
  icon: IconName
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}

/**
 * A sidebar entry styled to the Vision Brand specification.
 * Icons stay anchored whether collapsed or expanded; when collapsed, the label appears in a right-hand tooltip.
 */
export default function SidebarButton({ collapsed, icon, label, onClick, active, disabled }: SidebarButtonProps) {
  return (
    <Tooltip content={label} placement="right" disabled={!collapsed} targetTagName="div" fill={!collapsed}>
      <Button
        variant="minimal"
        fill={!collapsed}
        alignText={Alignment.START}
        className={`whitespace-nowrap text-body-2 transition-colors ${
          active
            ? 'bg-[#272727]! text-[#30aedb]! font-medium!'
            : 'text-white/87 hover:bg-[#272727]! hover:text-white!'
        }`}
        icon={icon}
        text={collapsed ? undefined : label}
        aria-label={label}
        active={active}
        disabled={disabled}
        onClick={onClick}
      />
    </Tooltip>
  )
}

