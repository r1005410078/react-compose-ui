import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@compose-ui/editor/styles.css'
import '@compose-ui/preview/styles.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
