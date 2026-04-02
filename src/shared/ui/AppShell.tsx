import type { PropsWithChildren, ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import { VisicLogoIcon } from "./visicIcons";


interface AppShellProps extends PropsWithChildren {
  className?: string;
  overlay?: ReactNode;
}


export function AppShell({ children, className, overlay }: AppShellProps) {
  return (
    <div className={`app-shell ${className ?? ""}`.trim()}>
      <header className="top-nav">
        <Link to="/" className="brand-mark" aria-label="CityWise home">
          <span className="brand-pin">
            <VisicLogoIcon />
          </span>
          <span className="brand-copy">CityWise</span>
        </Link>

        <nav className="top-nav-links" aria-label="Primary navigation">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/map">Map</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
      </header>

      {overlay ? <div className="shell-overlay">{overlay}</div> : null}
      <div className="shell-content">{children}</div>
    </div>
  );
}
