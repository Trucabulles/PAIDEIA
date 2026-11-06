export function AudioCoverFallback() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "grid",
        placeItems: "center",
        width: "100%",
        height: "100%",
        color: "#748CB4"
      }}
    >
      <svg viewBox="0 0 64 64" role="img">
        <path
          d="M18 40V25.5c0-8.3 5.9-14.5 14-14.5s14 6.2 14 14.5V40"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <rect x="10" y="34" width="12" height="18" rx="5" fill="currentColor" />
        <rect x="42" y="34" width="12" height="18" rx="5" fill="currentColor" />
        <path d="M28 30v17l13-8.5L28 30z" fill="currentColor" />
      </svg>
    </span>
  );
}
