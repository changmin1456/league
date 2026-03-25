import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const RIOT_VERIFY_CODE = '2dd31827-dc1f-486c-8f9a-a7dd8f261642'
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
