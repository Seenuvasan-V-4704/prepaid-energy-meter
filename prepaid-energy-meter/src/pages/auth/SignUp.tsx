import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import {
  isValidE164Phone,
  PHONE_EXAMPLE,
  PHONE_FORMAT_MESSAGE,
} from '../../lib/validation'

export default function SignUp() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (password.length < 8) {
      setError(
        'Password must contain at least 8 characters.'
      )
      return
    }

    const cleanPhone = phone.trim()

    if (!isValidE164Phone(cleanPhone)) {
      setError(PHONE_FORMAT_MESSAGE)
      return
    }

    setLoading(true)

    const { data, error } =
      await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
            phone: cleanPhone,
          },
        },
      })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    if (data.session) {
      navigate('/dashboard', { replace: true })
      return
    }

    setSuccess(
      'Account created. Check your email to confirm your account before signing in.'
    )
  }

  return (
    <AuthPage
      title="Create your account"
      subtitle="Create an account to manage your prepaid energy meter."
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Input
          label="Full name"
          value={fullName}
          onChange={setFullName}
          placeholder="Your full name"
          required
        />

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          required
        />

        <Input
          label="Phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder={PHONE_EXAMPLE}
          required
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Minimum 8 characters"
          required
        />

        {error && (
          <Message type="error">
            {error}
          </Message>
        )}

        {success && (
          <Message type="success">
            {success}
          </Message>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? 'Creating account...'
            : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link
          to="/signin"
          className="font-medium text-blue-600 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthPage>
  )
}

type InputProps = {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
}: InputProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  )
}

function AuthPage({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">
            PE
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            {title}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {subtitle}
          </p>
        </div>

        {children}
      </div>
    </div>
  )
}

function Message({
  type,
  children,
}: {
  type: 'error' | 'success'
  children: ReactNode
}) {
  return (
    <div
      className={
        type === 'error'
          ? 'rounded-lg bg-red-50 p-3 text-sm text-red-700'
          : 'rounded-lg bg-green-50 p-3 text-sm text-green-700'
      }
    >
      {children}
    </div>
  )
}