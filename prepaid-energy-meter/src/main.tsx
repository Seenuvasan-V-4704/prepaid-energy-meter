import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import SetupMessage from './components/SetupMessage'
import { envProblems } from './lib/env'

import './index.css'

const root = ReactDOM.createRoot(
  document.getElementById('root')!
)

async function start() {
  // If the settings are missing, show a friendly message instead
  // of a blank page.
  if (envProblems.length > 0) {
    root.render(
      <StrictMode>
        <SetupMessage problems={envProblems} />
      </StrictMode>
    )
    return
  }

  try {
    // The app is loaded only now, because loading it creates the
    // Supabase client, which needs the settings.
    const [{ default: App }, { AuthProvider }] =
      await Promise.all([
        import('./App'),
        import('./contexts/AuthContext'),
      ])

    root.render(
      <StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </StrictMode>
    )
  } catch (caught) {
    console.error(caught)

    root.render(
      <p style={{ padding: 24 }}>
        The app could not start. Please refresh the page.
      </p>
    )
  }
}

void start()
