import { Routes, Route, Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import Decks from "./pages/Decks";
import Import from "./pages/Import";
import Study from "./pages/Study";
import AddCard from "./pages/AddCard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import BugReporter from "./components/BugReporter";

export default function App() {
  const location = useLocation();

  return (
    <>
      <Toaster position="top-center" theme="dark" richColors />
      <motion.header
        className="glass-panel app-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
      >
        <Link to="/" className="app-title-link flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-60 mb-0.5" style={{ color: "var(--text-h)" }}>Spaced Repetition System</span>
          <h1 className="app-title">Japanese <span className="text-[#FF6B6B]">FSRS.</span></h1>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `btn-secondary nav-btn${isActive ? " is-active" : ""}`}>
            Decks
          </NavLink>
          <NavLink to="/add" className={({ isActive }) => `btn-secondary nav-btn${isActive ? " is-active" : ""}`}>
            Add Card
          </NavLink>
          <NavLink to="/import" className={({ isActive }) => `btn-secondary nav-btn${isActive ? " is-active" : ""}`}>
            Import
          </NavLink>
        </nav>
      </motion.header>
      <main className="main-content">
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Decks />} />
              <Route path="/add" element={<AddCard />} />
              <Route path="/import" element={<Import />} />
              <Route path="/study" element={<Study />} />
            </Routes>
          </AnimatePresence>
        </ErrorBoundary>
      </main>
      <BugReporter />
    </>
  );
}
