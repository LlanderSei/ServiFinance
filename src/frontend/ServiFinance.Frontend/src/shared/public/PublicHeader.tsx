import { Link, useLocation } from "react-router-dom";
import { toPlatformRoute } from "@/platform/runtime";

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
    <header className="public-header">
      <div className="public-header__inner">
        <Link to="/" className="brand">
          <span className="brand__mark">SF</span>
          <span>
            <strong>ServiFinance</strong>
            <small>Unified operations and lending</small>
          </span>
        </Link>

        {!isRegister && (
          <nav className="public-nav">
            <button type="button" onClick={() => scrollToSection("platform")}>Platform</button>
            <button type="button" onClick={() => scrollToSection("plans")}>Plans</button>
            <button type="button" onClick={() => scrollToSection("workflow")}>How It Works</button>
          </nav>
        )}

        <div className="public-header__actions">
          <button type="button" className="button button--ghost" onClick={handleLogin}>
            Login
          </button>
          <Link to={isRegister ? "/" : "/register"} className="button button--primary">
            {isRegister ? "Back Home" : "Register"}
          </Link>
        </div>
      </div>
    </header>
  );
}
