import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BlueprintProvider } from '@blueprintjs/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BlueprintProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BlueprintProvider>
  </StrictMode>,
)
