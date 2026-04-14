import { Link, useLocation } from "react-router-dom";
import { toPlatformRoute } from "@/platform/runtime";
import { PublicButton, PublicButtonLink, PublicContainer } from "@/shared/public/PublicPrimitives";

type Props = {
  onLoginRequested?: () => void;
};

export function PublicHeader({ onLoginRequested }: Props) {
  const location = useLocation();
  const isRegister = location.pathname === "/register";
  const handleLogin = () => {
    if (onLoginRequested) {
      onLoginRequested();
      return;
    }

    window.location.assign(toPlatformRoute("/?showLogin=true"));
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header className="sticky top-0 z-20 px-7 pt-6">
      <PublicContainer>
        <div className="flex items-center justify-between gap-4 rounded-full border border-white/70 bg-white/92 px-4 py-4 shadow-[0_16px_34px_rgba(35,46,76,0.08),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm">
          <Link to="/" className="inline-flex items-center gap-3 text-inherit no-underline">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#53d5cb] via-[#7c9cff] to-[#8f7dff] font-bold text-white shadow-[0_16px_34px_rgba(107,145,255,0.22)]">
              SF
            </span>
            <span>
              <strong className="block text-base tracking-[-0.02em] text-slate-950">ServiFinance</strong>
              <small className="block text-slate-500">Unified operations and lending</small>
            </span>
          </Link>

          {!isRegister && (
            <nav className="hidden gap-8 md:inline-flex">
              <button type="button" className="bg-transparent p-0 text-[rgba(20,24,39,0.68)] hover:text-slate-950" onClick={() => scrollToSection("platform")}>Platform</button>
              <button type="button" className="bg-transparent p-0 text-[rgba(20,24,39,0.68)] hover:text-slate-950" onClick={() => scrollToSection("plans")}>Plans</button>
              <button type="button" className="bg-transparent p-0 text-[rgba(20,24,39,0.68)] hover:text-slate-950" onClick={() => scrollToSection("workflow")}>How It Works</button>
            </nav>
          )}

          <div className="flex gap-3">
            <PublicButton tone="ghost" onClick={handleLogin}>
              Login
            </PublicButton>
            <PublicButtonLink to={isRegister ? "/" : "/register"} tone="primary">
              {isRegister ? "Back Home" : "Register"}
            </PublicButtonLink>
          </div>
        </div>
      </PublicContainer>
    </header>
  );
}
