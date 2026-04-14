import type { PropsWithChildren, ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

interface AppShellProps extends PropsWithChildren {
  className?: string;
  overlay?: ReactNode;
}


export function AppShell({ children, className, overlay }: AppShellProps) {
  return (
    <div className={`app-shell ${className ?? ""}`.trim()}>
      <header className="top-nav">
        <Link to="/" className="brand-mark brand-mark--wordmark" aria-label="CityWise home">
          <span className="brand-pin">
            <img src="/brand/visic-logo.png" alt="" />
          </span>
          <span className="brand-wordmark">CityWise</span>
        </Link>

        <nav className="top-nav-links" aria-label="Primary navigation">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/map">Map</NavLink>
          {/* <NavLink to="/about">About</NavLink> */}
        </nav>
      </header>

      {overlay ? <div className="shell-overlay">{overlay}</div> : null}
      <div className="shell-content">{children}</div>
    </div>
  );
}
