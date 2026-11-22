import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import WeeklySchedulePage from './pages/WeeklySchedulePage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/schedule" element={<WeeklySchedulePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}