import { useState, type FormEvent } from 'react'
import { useLogin } from '@/composables/ApiWrappers/Auth/useLogin'

/** Sign-in form state matching AberWest's composable pattern. */
export function useLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const login = useLogin()

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!email.trim() || !password) {
      setFormError('Enter your email and password to continue.')
      return
    }

    setFormError(null)
    login.mutate({ email, password })
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    error: formError ?? (login.isError ? login.error.message : null),
    inputsInvalid: !!formError,
    isSigningIn: login.isPending,
    handleSubmit,
  }
}
