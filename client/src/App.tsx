import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import RoomPage from './pages/RoomPage'
import SpectatePage from './pages/SpectatePage'
import RoomsPage from './pages/RoomsPage'
import DevPanel from './components/DevPanel'
import ErrorToast from './components/ErrorToast'
import SoundToggle from './components/SoundToggle'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/spectate/:roomId" element={<SpectatePage />} />
      </Routes>
      {import.meta.env.DEV && <DevPanel />}
      <ErrorToast />
      <SoundToggle />
    </>
  )
}
