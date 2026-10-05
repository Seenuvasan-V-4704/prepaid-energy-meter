import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import type {
  AuthChangeEvent,
  Session,
  User,
} from '@supabase/supabase-js'

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
  // True only during the very first start-up check.
  loading: boolean
  // True ONLY while no profile result exists yet for the current user.
  // Background refreshes never turn this on.
  profileLoading: boolean
  // Problems with sign-in state or sign-out.
  error: string | null
  // Set when loading the profile failed. Cleared by a successful load.
  profileError: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
)

const PROFILE_COLUMNS =
  'id, full_name, phone, role, whatsapp_opt_in, created_at'

// The outcome of a profile load, tagged with the user it belongs to.
// Because it carries the user id, a result for a previous user is
// ignored automatically and never shows up for the new user.
type ProfileState = {
  userId: string
  profile: Profile | null
  error: string | null
}

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [profileState, setProfileState] =
    useState<ProfileState | null>(null)

  // The user id we have already started loading a profile for.
  // null means nobody is signed in.
  const activeUserIdRef = useRef<string | null>(null)

  const userId = user?.id ?? null

  // ---- Values derived from the state above ----
  const currentProfileState =
    profileState && profileState.userId === userId
      ? profileState
      : null

  const profile = currentProfileState?.profile ?? null
  const profileError = currentProfileState?.error ?? null

  // "Loading" means: someone is signed in, but we have no result
  // (success or failure) for them yet.
  const profileLoading =
    userId !== null && currentProfileState === null

  // ---- Load the profile row from Supabase ----
  // Used for the first load, for refreshProfile and for Retry.
  // It never touches the loading flags.
  const loadProfile = useCallback(async (id: string) => {
    let loadedProfile: Profile | null = null
    let message: string | null = null

    try {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', id)
        .single()

      if (queryError) {
        message = queryError.message
      } else {
        loadedProfile = data as Profile
      }
    } catch (caught) {
      message =
        caught instanceof Error
          ? caught.message
          : 'Could not load your profile.'
    }

    // The user signed out or changed while we waited: drop the result.
    if (activeUserIdRef.current !== id) {
      return
    }

    setProfileState((previous) => ({
      userId: id,
      // If this was only a failed refresh, keep the profile we
      // already had instead of blanking the screen.
      profile:
        loadedProfile ??
        (previous?.userId === id ? previous.profile : null),
      error: message,
    }))
  }, [])

  // ---- Load the profile only when the signed-in user id changes ----
  // Token refreshes and tab refocus keep the same id, so this effect
  // does not run again for them.
  useEffect(() => {
    if (activeUserIdRef.current === userId) {
      return
    }

    activeUserIdRef.current = userId

    if (userId) {
      void loadProfile(userId)
    }
  }, [userId, loadProfile])

  // ---- Keep session and user in sync with Supabase ----
  useEffect(() => {
    let active = true

    // Only stores values. It makes NO Supabase calls, because calling
    // Supabase from inside onAuthStateChange can freeze the app.
    function applySession(
      nextSession: Session | null,
      event?: AuthChangeEvent
    ) {
      // Same access token = nothing really changed (tab refocus).
      setSession((previous) =>
        previous?.access_token === nextSession?.access_token
          ? previous
          : nextSession
      )

      setUser((previous) => {
        const nextUser = nextSession?.user ?? null

        if (!nextUser) {
          return null
        }

        // Same person: keep the very same object, so pages that
        // depend on "user" do not re-run on every token refresh.
        if (
          previous &&
          previous.id === nextUser.id &&
          event !== 'USER_UPDATED'
        ) {
          return previous
        }

        return nextUser
      })
    }

    // Later changes: sign in, sign out, token refresh, and so on.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      // The first read is done by start() below.
      if (event === 'INITIAL_SESSION' || !active) {
        return
      }

      applySession(newSession, event)
    })

    // The first read, at start-up. This is the only start-up path.
    async function start() {
      try {
        const { data, error: sessionError } =
          await supabase.auth.getSession()

        if (!active) {
          return
        }

        if (sessionError) {
          setError(sessionError.message)
        }

        applySession(data.session)
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Could not check your sign-in.'
          )
        }
      } finally {
        // Always end the start-up loading state, whatever happened.
        if (active) {
          setLoading(false)
        }
      }
    }

    void start()

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // ---- Public actions ----
  const refreshProfile = useCallback(async () => {
    const id = activeUserIdRef.current

    if (id) {
      await loadProfile(id)
    }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    const { error: signOutError } =
      await supabase.auth.signOut()

    if (signOutError) {
      setError(signOutError.message)
      return
    }

    setError(null)
    setUser(null)
    setSession(null)
  }, [])

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      loading,
      profileLoading,
      error,
      profileError,
      refreshProfile,
      signOut,
    }),
    [
      user,
      session,
      profile,
      loading,
      profileLoading,
      error,
      profileError,
      refreshProfile,
      signOut,
    ]
  )

  return (
    <AuthContext.Provider value={value}>
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
