import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ForensicProvider } from './store/useForensicStore'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ForensicProvider>
      <App />
    </ForensicProvider>
  </React.StrictMode>,
)
