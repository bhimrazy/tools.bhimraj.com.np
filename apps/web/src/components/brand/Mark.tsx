import type { SVGProps } from "react";

/** The mark on its 32-unit grid: ring (outer r 15, inner r 11) and a dot at 3 o'clock. Never move the dot. */
export function Mark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" {...props}>
      <path
        className="mk-ring"
        fillRule="evenodd"
        d="M16 1a15 15 0 1 0 0 30a15 15 0 1 0 0-30ZM16 5a11 11 0 1 0 0 22a11 11 0 1 0 0-22Z"
      />
      <circle className="mk-dot" cx="20.5" cy="16" r="3.5" />
    </svg>
  );
}

/** "Tools" with "by Bhimraj" at 55% on the same baseline. Never drop or stack "by Bhimraj". */
export function Lockup({
  href,
  className = "",
}: {
  href?: string;
  className?: string;
}) {
  const inner = (
    <>
      <Mark />
      <span className="lk-t">
        <span className="lk-w">Tools</span>
        <span className="lk-by">by Bhimraj</span>
      </span>
    </>
  );
  return href ? (
    <a
      className={`lockup ${className}`}
      href={href}
      aria-label="Tools by Bhimraj, home"
    >
      {inner}
    </a>
  ) : (
    <span
      className={`lockup ${className}`}
      role="img"
      aria-label="Tools by Bhimraj"
    >
      {inner}
    </span>
  );
}
