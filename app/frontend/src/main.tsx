import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppProvider } from './state'
import './styles.css'
import { STATIC } from './api'
import { initLocal } from './static/localApi'
const start = () => ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppProvider><App /></AppProvider></React.StrictMode>)
if (STATIC) initLocal(import.meta.env.BASE_URL).then(start); else start()
