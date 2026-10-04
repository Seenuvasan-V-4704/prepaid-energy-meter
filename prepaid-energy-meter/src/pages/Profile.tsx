import {
  FormEvent,
  useEffect,
  useState,
} from 'react'

import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

function isValidPhone(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone)
}

export default function Profile() {
  const {
    user,
    profile,
    refreshProfile,
  } = useAuth()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsappOptIn, setWhatsappOptIn] =
    useState(false)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) {
      return
    }

    setFullName(profile.full_name ?? '')
    setPhone(profile.phone ?? '')
    setWhatsappOptIn(profile.whatsapp_opt_in)
  }, [profile])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!phone || !isValidPhone(phone)) {
      setError(
        'Phone must use E.164 format, for example +919876543210.'
      )
      return
    }

    if (!user) {
      setError('You must be signed in.')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone,
        whatsapp_opt_in: whatsappOptIn,
      })
      .eq('id', user.id)

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    await refreshProfile()

    setMessage('Profile updated successfully.')
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-slate-900">
        Profile
      </h2>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </span>

            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Full name
            </span>

            <input
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Phone
            </span>

            <input
              type="tel"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
              placeholder="+919876543210"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(event) =>
                setWhatsappOptIn(
                  event.target.checked
                )
              }
              className="mt-1 h-4 w-4"
            />

            <span>
              <span className="block text-sm font-medium text-slate-800">
                WhatsApp notifications
              </span>

              <span className="text-sm text-slate-500">
                Allow the application to send low-balance
                WhatsApp alerts to this number.
              </span>
            </span>
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? 'Saving...'
              : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}