import { Button, Card, H3, InputGroup, Intent, Spinner, Text } from '@blueprintjs/core'
import platformScan from '@/assets/3d-platform-scan.webp'
import Header from '@/components/Header'
import { useLoginForm } from './Composables/useLoginForm'

export default function Login() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    error,
    inputsInvalid,
    isSigningIn,
    handleSubmit,
  } = useLoginForm()

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-[#111111]">
      <Header />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Side: Login Form (50vw) */}
        <div className="flex w-1/2 items-center justify-center overflow-hidden bg-[#1C1C1C] p-[8%]">
          {isSigningIn ? (
            <Card elevation={2} className="flex flex-col items-center p-8 bg-[#272727]">
              <Spinner size={50} intent={Intent.PRIMARY} />
              <Text className="text-body-2 text-white/60 mt-4">Authenticating session...</Text>
            </Card>
          ) : (
            <div className="w-full max-w-sm">
              <div className="mb-6 text-center">
                <H3 className="text-h3 text-white/87 mb-2">Sign in</H3>
                <Text className="text-body-2 text-white/60">
                  Sign in to continue to ShipHappens
                </Text>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <InputGroup
                  large
                  leftIcon="envelope"
                  type="email"
                  placeholder="Email"
                  value={email}
                  intent={inputsInvalid && !email ? Intent.DANGER : undefined}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full mb-1"
                  autoFocus
                />

                {showPassword && (
                  <InputGroup
                    large
                    leftIcon="key"
                    type="password"
                    placeholder="Password"
                    value={password}
                    intent={inputsInvalid && !password ? Intent.DANGER : undefined}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full mb-1"
                    autoFocus
                  />
                )}

                {error && (
                  <Text className="text-body-2 text-[#ff5252]">
                    {error}
                  </Text>
                )}

                <Button
                  type="submit"
                  intent={Intent.PRIMARY}
                  large
                  text={showPassword ? 'Log in' : 'Next'}
                  className="w-full mt-2 ml-0!"
                />
              </form>
            </div>
          )}
        </div>

        {/* Right Side: 3D Platform Scan Imagery (50vw) */}
        <div className="w-1/2 h-full overflow-hidden bg-black flex items-center justify-center border-l border-white/12">
          <img
            src={platformScan}
            alt="3D Point Cloud Image of Offshore Oil and Gas Platform"
            className="block h-full w-full object-contain"
          />
        </div>
      </div>
    </div>
  )
}
