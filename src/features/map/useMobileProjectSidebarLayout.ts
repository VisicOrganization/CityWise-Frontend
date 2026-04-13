import { useEffect, useState } from "react";

/** Matches `app.css` @media (max-width: 640px) for map / project sidebar. */
export const MOBILE_PROJECT_SIDEBAR_MEDIA = "(max-width: 640px)";

export function useMobileProjectSidebarLayout(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_PROJECT_SIDEBAR_MEDIA);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile;
}
