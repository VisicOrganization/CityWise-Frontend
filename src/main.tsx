import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";

import App from "./app/App";
import "maplibre-gl/dist/maplibre-gl.css";
import "./tailwind.css";
import "./app.css";

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_TOKEN;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

// Require a build-time token so we never call posthog.init(undefined) in production.
const isPostHogEnabled =
  import.meta.env.PROD &&
  typeof posthogToken === "string" &&
  posthogToken.length > 0;

if (isPostHogEnabled) {
  posthog.init(posthogToken, {
    api_host: posthogHost || "https://us.i.posthog.com",
    defaults: "2026-01-30",
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isPostHogEnabled ? (
      <PostHogProvider client={posthog}>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </PostHogProvider>
    ) : (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    )}
  </React.StrictMode>,
);
