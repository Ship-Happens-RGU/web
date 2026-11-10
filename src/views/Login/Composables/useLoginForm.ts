import { useState, type FormEvent } from 'react'
import { useLogin } from '@/composables/ApiWrappers/Auth/useLogin'

/** Sign-in form state matching AberWest's composable pattern. */
export function useLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const login = useLogin()

  const handleEmailChange = (value: string) => {
    setEmail(value)
    if (formError) setFormError(null)
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (formError) setFormError(null)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!email.trim()) {
      setFormError('Enter your email to continue.')
      return
    }

    if (!showPassword) {
      setFormError(null)
      setShowPassword(true)
      return
    }

    if (!password) {
      setFormError('Enter your password to continue.')
      return
    }

    setFormError(null)
    login.mutate({ email: email.trim(), password })
  }

  return {
    email,
    setEmail: handleEmailChange,
    password,
    setPassword: handlePasswordChange,
    showPassword,
    error: formError ?? (login.isError ? login.error.message : null),
    inputsInvalid: !!formError,
    isSigningIn: login.isPending,
    handleSubmit,
  }
}
