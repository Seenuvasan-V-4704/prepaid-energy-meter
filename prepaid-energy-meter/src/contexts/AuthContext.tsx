import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { Session, User } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'

export type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  role: 'user' | 'admin'
  whatsapp_opt_in: boolean
  created_at: string
}

type AuthContextType = {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean
  error: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  const [profile, setProfile] =
    useState<Profile | null>(null)

  const [loading, setLoading] = useState(true)

  const [profileLoading, setProfileLoading] =
    useState(false)

  const [error, setError] = useState<string | null>(null)

  async function loadProfile(userId: string) {
    setProfileLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, phone, role, whatsapp_opt_in, created_at'
      )
      .eq('id', userId)
      .single()

    if (error) {
      setProfile(null)
      setError(error.message)
    } else {
      setProfile(data as Profile)
    }

    setProfileLoading(false)
  }

  async function refreshProfile() {
    if (!user) {
      setProfile(null)
      return
    }

    await loadProfile(user.id)
  }

  useEffect(() => {
    let mounted = true

    async function initialize() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) {
        return
      }

      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        await loadProfile(session.user.id)
      }

      setLoading(false)
    }

    initialize()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) {
          return
        }

        setSession(newSession)
        setUser(newSession?.user ?? null)

        if (!newSession?.user) {
          setProfile(null)
        } else {
          loadProfile(newSession.user.id)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      return
    }

    setUser(null)
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileLoading,
        error,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    )
  }

  return context
}