export default function Header() {
  return (
    <header className="relative z-20 border-b border-line/70 bg-bg/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2.5">
          {/* Three bars of a trace waterfall, offset the way spans nest */}
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <rect x="2" y="4" width="14" height="4.5" rx="2" fill="#7c9eff" />
            <rect x="6" y="10" width="12" height="4.5" rx="2" fill="#3ddc97" opacity="0.9" />
            <rect x="10" y="16" width="9" height="4.5" rx="2" fill="#ffb454" opacity="0.85" />
          </svg>
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Agent Ops</span>
        </a>

        <nav className="flex items-center gap-5">
          <a
            href="https://github.com/negiadventures/agent-ops"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-muted transition-colors hover:text-fg"
          >
            GitHub
          </a>
          <a
            href="https://schemadrift.negiventures.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-[13px] text-muted transition-colors hover:text-fg sm:block"
          >
            Schema Drift
          </a>
          <a
            href="https://negiventures.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-[13px] text-muted transition-colors hover:text-fg sm:block"
          >
            Negi Ventures
          </a>
        </nav>
      </div>
    </header>
  );
}
