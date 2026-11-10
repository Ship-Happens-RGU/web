import { Alignment, Button, Tooltip, type IconName } from '@blueprintjs/core'

interface SidebarButtonProps {
  collapsed: boolean
  icon: IconName
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}

export default function SidebarButton({
  collapsed,
  icon,
  label,
  onClick,
  active,
  disabled,
}: SidebarButtonProps) {
  return (
    <Tooltip
      content={label}
      placement="right"
      disabled={!collapsed}
      targetTagName="div"
      fill
    >
      <Button
        variant="minimal"
        fill
        alignText={collapsed ? Alignment.CENTER : Alignment.START}
        className={`h-10! w-full! whitespace-nowrap text-body-2 transition-colors ${
          active
            ? 'bg-[#272727]! text-[#30aedb]! font-medium!'
            : 'text-white/87 hover:bg-[#272727]! hover:text-white!'
        } ${collapsed ? 'justify-center!' : ''}`}
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
