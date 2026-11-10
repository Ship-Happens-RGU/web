import { Button, Card, H1, InputGroup, Intent, Spinner, Text } from '@blueprintjs/core'
import oceaneeringLogo from '@/assets/oceaneering-logo.png'
import Header from '@/components/Header'
import { useLoginForm } from './Composables/useLoginForm'

export default function Login() {
  const { email, setEmail, password, setPassword, error, inputsInvalid, isSigningIn, handleSubmit } = useLoginForm()

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-[#1c2127]">
      <Header />
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
        {isSigningIn ? (
          <Card elevation={2} className="flex flex-col items-center p-8 bg-[#252a31] border border-slate-700">
            <Spinner size={50} intent={Intent.PRIMARY} />
            <Text className="text-sm text-slate-300 mt-4">Authenticating session...</Text>
          </Card>
        ) : (
          <div className="w-full max-w-sm flex flex-col items-center">
            <div className="mb-6 text-center flex flex-col items-center">
              <img
                src={oceaneeringLogo}
                alt="Oceaneering"
                className="h-10 w-auto object-contain mb-4"
              />
              <H1 className="text-3xl! font-bold text-white mb-2">Sign in</H1>
              <Text className="text-sm opacity-70 dark:opacity-100 text-slate-300">
                Sign in to continue to ShipHappens
              </Text>
            </div>

            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
              <InputGroup
                large
                leftIcon="envelope"
                type="email"
                placeholder="Email"
                value={email}
                intent={inputsInvalid && !email ? Intent.DANGER : undefined}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full"
                autoFocus
              />

              <InputGroup
                large
                leftIcon="key"
                type="password"
                placeholder="Password"
                value={password}
                intent={inputsInvalid && !password ? Intent.DANGER : undefined}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full"
              />

              {error && (
                <Text className="text-sm text-red-400">
                  {error}
                </Text>
              )}

              <Button
                type="submit"
                intent={Intent.PRIMARY}
                large
                text="Log in"
                className="w-full mt-2"
              />
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
