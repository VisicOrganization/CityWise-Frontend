import type { ReactNode } from "react";

type Variant = "blue" | "grey" | "green";

function LandingCommentBubble({ variant, children }: { variant: Variant; children: ReactNode }) {
  return (
    <div className={`landing-comment landing-comment--${variant}`} aria-hidden="true">
      <div className="landing-comment-bubble">
        <p className="landing-comment-bubble-text">{children}</p>
      </div>
    </div>
  );
}

export function LandingCommentBlue({ children }: { children: ReactNode }) {
  return <LandingCommentBubble variant="blue">{children}</LandingCommentBubble>;
}

export function LandingCommentGrey({ children }: { children: ReactNode }) {
  return <LandingCommentBubble variant="grey">{children}</LandingCommentBubble>;
}

export function LandingCommentGreen({ children }: { children: ReactNode }) {
  return <LandingCommentBubble variant="green">{children}</LandingCommentBubble>;
}
