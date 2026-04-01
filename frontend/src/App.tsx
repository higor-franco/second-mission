import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from '@/pages/LandingPage'
import TranslatePage from '@/pages/TranslatePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/translate" element={<TranslatePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
