import { Button, Card, Intent, Text } from '@blueprintjs/core'
import Header from '@/components/Header'
import { useLogout } from '@/composables/ApiWrappers/Auth/useLogout'
import { useMe } from '@/composables/ApiWrappers/Auth/useMe'

export default function Dashboard() {
  const user = useMe().data
  const logout = useLogout()

  if (!user) {
    return null
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-[#1c2127]">
      <Header>
        <Button
          intent={Intent.DANGER}
          minimal
          icon="log-out"
          loading={logout.isPending}
          onClick={() => logout.mutate()}
        >
          Log out
        </Button>
      </Header>

      <div className="flex flex-1 items-center justify-center p-6">
        <Card elevation={2} className="flex flex-col items-center gap-4 py-10 px-8 text-center max-w-md w-full bg-[#252a31] border border-slate-700">
          <Text className="text-xl font-bold dark:text-white">
            Welcome{user.displayName ? `, ${user.displayName}` : ''}!
          </Text>
          <Text className="text-sm opacity-70 dark:opacity-100 dark:text-white">
            Signed in as {user.email}
          </Text>
          <Button
            intent={Intent.DANGER}
            icon="log-out"
            loading={logout.isPending}
            onClick={() => logout.mutate()}
            className="mt-2"
          >
            Log out
          </Button>
        </Card>
      </div>
    </div>
  )
}
