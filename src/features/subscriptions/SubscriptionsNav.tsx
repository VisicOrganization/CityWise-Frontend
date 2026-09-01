import { NavLink } from "react-router-dom";

export function SubscriptionsNav() {
  return (
    <nav className="subscriptions-subnav" aria-label="Subscriptions">
      <NavLink to="/new-files">New files</NavLink>
      <NavLink to="/subscriptions/settings">Settings</NavLink>
      <NavLink to="/subscriptions/plans">Plans</NavLink>
    </nav>
  );
}
