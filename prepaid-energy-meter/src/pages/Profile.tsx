import type { FormEvent } from 'react'
import { useState } from 'react'

import {
  useAuth,
  type Profile as ProfileData,
} from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  isValidE164Phone,
  PHONE_EXAMPLE,
  PHONE_FORMAT_MESSAGE,
} from '../lib/validation'

export default function Profile() {
  const { profile } = useAuth()

  if (!profile) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-slate-900">
          Profile
        </h2>

        <div className="mt-6 rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          Your profile is not available right now. Use the
          Retry button in the red message above, or reload
          the page.
        </div>
      </div>
    )
  }

  // key={profile.id}: the form starts fresh once per user, and is
  // NOT reset when the profile is refreshed in the background.
  return <ProfileForm key={profile.id} profile={profile} />
}

function ProfileForm({
  profile,
}: {
  profile: ProfileData
}) {
  const { user, refreshProfile } = useAuth()

  // These start from the saved profile ONCE. Later refreshes of the
  // profile never overwrite what the user is typing.
  const [fullName, setFullName] = useState(
    profile.full_name ?? ''
  )
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [whatsappOptIn, setWhatsappOptIn] = useState(
    profile.whatsapp_opt_in
  )

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')
    setMessage('')

    const cleanName = fullName.trim()
    const cleanPhone = phone.trim()

    if (!cleanName) {
      setError('Please enter your full name.')
      return
    }

    if (!isValidE164Phone(cleanPhone)) {
      setError(PHONE_FORMAT_MESSAGE)
      return
    }

    setSaving(true)

    // .select().single() makes Supabase send the updated row back.
    // If nothing was really updated, we get an error instead of a
    // false "saved" message.
    const { data, error: saveError } = await supabase
      .from('profiles')
      .update({
        full_name: cleanName,
        phone: cleanPhone,
        whatsapp_opt_in: whatsappOptIn,
      })
      .eq('id', profile.id)
      .select('id')
      .single()

    setSaving(false)

    if (saveError || !data) {
      setError(
        saveError && saveError.code !== 'PGRST116'
          ? saveError.message
          : 'Your changes were not saved because no profile row was updated. Please sign out, sign in again and retry.'
      )
      return
    }

    setFullName(cleanName)
    setPhone(cleanPhone)

    // Update the name shown in the header.
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
              placeholder={PHONE_EXAMPLE}
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
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
