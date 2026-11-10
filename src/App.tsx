import { Spinner, Intent } from '@blueprintjs/core'
import { useMe } from '@/composables/ApiWrappers/Auth/useMe'
import Login from '@/views/Login/Login'
import Dashboard from '@/views/Dashboard/Dashboard'

export default function App() {
  const { data: user, isPending } = useMe()

  if (isPending) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-[#1c2127]">
        <Spinner size={50} intent={Intent.PRIMARY} />
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return <Dashboard />
}
