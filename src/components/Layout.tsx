import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { LogOut, LayoutDashboard, Sparkles, Menu, X } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-base flex flex-col">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="font-heading text-sm text-white">F</span>
              </div>
              <span className="font-heading text-lg text-foreground tracking-tight">
                Forge<span className="text-primary">OS</span>
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                location.pathname === "/dashboard"
                  ? "bg-elevated text-primary"
                  : "text-muted hover:text-foreground hover:bg-surface"
              }`}
            >
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
            <Link
              to="/project-manager"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                location.pathname === "/project-manager"
                  ? "bg-elevated text-primary"
                  : "text-muted hover:text-foreground hover:bg-surface"
              }`}
            >
              <Sparkles size={16} />
              AI Project Manager
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors duration-200 cursor-pointer rounded-lg hover:bg-surface"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-muted hover:text-foreground cursor-pointer"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-surface px-4 py-3 space-y-1 animate-fade-in-up">
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-elevated"
            >
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
            <Link
              to="/project-manager"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-elevated"
            >
              <Sparkles size={16} />
              AI Project Manager
            </Link>
            <div className="pt-2 border-t border-border">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted hover:text-foreground cursor-pointer w-full text-left"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
