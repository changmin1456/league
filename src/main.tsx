import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const RIOT_VERIFY_CODE = 'fad8c1da-d06b-43f8-aec6-572e3bb1c18f'
const isRiotHashVerifyPath = window.location.hash === '#전적/riot.txt'

if (isRiotHashVerifyPath) {
  document.body.innerText = RIOT_VERIFY_CODE
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
