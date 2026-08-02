import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Landing } from './pages/Landing';
import { Timeline } from './pages/Timeline';
import { ClaimChecker } from './components/ClaimChecker';
import { StoryDetail } from './components/StoryDetail';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

function MainLayout() {
  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      
      {/* Ambient Premium Backgrounds */}
      <div className="mesh-bg" />
      <div className="grain-overlay" />

      {/* Router-aware Navbar */}
      <Navbar />

      <main style={{ paddingTop: 120, paddingBottom: 100 }}>
        <div className="container">
          <Routes>
            {/* Task 1 & 2: Landing Page Route */}
            <Route path="/" element={<Landing />} />

            {/* Task 1 & 2: Timeline Route (Feed Grid only, no marketing hero) */}
            <Route path="/timeline" element={<Timeline />} />

            {/* Task 1: Reactive Claim Checker Route */}
            <Route path="/checker" element={<ClaimChecker />} />

            {/* Task 1 & 5: Story Detail Route */}
            <Route path="/story/:id" element={<StoryDetail />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
