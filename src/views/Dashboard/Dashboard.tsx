import { Button, Card, Intent, Text } from '@blueprintjs/core'
import { useSidebar } from '@/components/sidebar/Composables/useSidebar'
import { useLogout } from '@/composables/ApiWrappers/Auth/useLogout'
import { useMe } from '@/composables/ApiWrappers/Auth/useMe'
import AppShell from '@/layouts/AppShell'
import CenteredPage from '@/layouts/CenteredPage'
import ViewerView from '@/views/Viewer/ViewerView'

export default function Dashboard() {
  const user = useMe().data
  const logout = useLogout()
  const { activeSection } = useSidebar()

  if (!user) {
    return null
  }

  return (
    <AppShell>
      <ViewerView active={activeSection === 'viewer'} />
      {activeSection !== 'viewer' && (
        <CenteredPage icon="home" crumbs={[{ label: 'ShipHappens' }, { label: 'Dashboard' }]}>
          <Card elevation={2} className="flex flex-col items-center gap-4 py-10 px-8 text-center max-w-md w-full bg-[#1c1c1c]">
            <Text className="text-h5 text-white/87">
              Welcome{user.displayName ? `, ${user.displayName}` : ''}!
            </Text>
            <Text className="text-body-2 text-white/60">
              Signed in as {user.email}
            </Text>
            <Button
              intent={Intent.DANGER}
              icon="log-out"
              loading={logout.isPending}
              onClick={() => logout.mutate()}
              className="mt-2 ml-0!"
            >
              Log out
            </Button>
          </Card>
        </CenteredPage>
      )}
    </AppShell>
  )
}
