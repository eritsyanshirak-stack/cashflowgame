import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './v13.css'
import App from './App'
import V13Overlay from './V13Overlay'

createRoot(document.getElementById('root')!).render(<StrictMode><App /><V13Overlay /></StrictMode>)
