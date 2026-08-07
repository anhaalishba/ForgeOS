import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { LogIn, Sparkles } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        // Supabase might auto-confirm in dev
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 mb-4">
            <Sparkles size={32} className="text-primary" />
          </div>
          <h1 className="font-heading text-3xl text-foreground tracking-tight">
            Forge<span className="text-primary">OS</span>
          </h1>
          <p className="text-muted text-sm mt-2">
            Your AI Workforce, One Command Away
          </p>
        </div>

        {/* Form */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-lg">
          <h2 className="font-heading text-xl text-foreground mb-6">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 rounded-xl bg-base border border-border text-foreground placeholder:text-subtle text-sm transition-all duration-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Your password"
                minLength={6}
                className="w-full px-4 py-2.5 rounded-xl bg-base border border-border text-foreground placeholder:text-subtle text-sm transition-all duration-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:shadow-primary-glow active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
              }}
              className="text-sm text-muted hover:text-primary transition-colors duration-200 cursor-pointer"
            >
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
