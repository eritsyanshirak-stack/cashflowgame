import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './v14.css'
import './v15.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
