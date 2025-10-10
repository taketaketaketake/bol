import { useState } from 'react';

interface SiteHeaderProps {
  session?: any;
  currentPath?: string;
}

export default function SiteHeader({ session, currentPath }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/services", label: "Services" },
    { href: "/pricing", label: "Pricing" },
    { href: "/service-areas", label: "Service Areas" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/laundromat-partners", label: "Partners" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 hover:no-underline">
            <img src="/images/t shirt.PNG" alt="Bags of Laundry" className="h-10 w-auto" />
            <img src="/images/bags of laundry logo - Copy.png" alt="Bags of Laundry Logo" className="h-10 w-auto" />
          </a>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={
                  currentPath === link.href
                    ? "text-brand-primary font-semibold"
                    : "text-brand-text hover:text-brand-primary transition"
                }
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-3">
            {session ? (
              <>
                <a
                  href="/dashboard"
                  className={
                    currentPath === "/dashboard"
                      ? "text-brand-primary font-semibold"
                      : "text-brand-text hover:text-brand-primary transition"
                  }
                >
                  Dashboard
                </a>
                <div className="flex items-center gap-2 text-sm text-brand-text">
                  <span>
                    Hi, {session.user?.user_metadata?.full_name || session.user?.email?.split("@")[0]}!
                  </span>
                </div>
                <a href="/api/auth/signout" className="btn-ghost text-sm">Sign Out</a>
              </>
            ) : (
              <>
                <a href="/auth/login" className="btn-ghost">Sign In</a>
                <a href="/start-basic" className="btn">Schedule</a>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 rounded-md text-brand-text hover:text-brand-primary focus:outline-none"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-brand-line bg-brand-bg/95 backdrop-blur-sm">
          <nav className="flex flex-col space-y-4 px-6 py-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={
                  currentPath === link.href
                    ? "text-brand-primary font-semibold"
                    : "text-brand-text hover:text-brand-primary transition"
                }
              >
                {link.label}
              </a>
            ))}
            {session ? (
              <>
                <a
                  href="/dashboard"
                  className={
                    currentPath === "/dashboard"
                      ? "text-brand-primary font-semibold"
                      : "text-brand-text hover:text-brand-primary transition"
                  }
                >
                  Dashboard
                </a>
                <div className="text-sm text-brand-text">
                  Hi, {session.user?.user_metadata?.full_name || session.user?.email?.split("@")[0]}!
                </div>
                <a href="/api/auth/signout" className="btn-ghost text-sm w-full text-left">Sign Out</a>
              </>
            ) : (
              <>
                <a href="/auth/login" className="btn-ghost">Sign In</a>
                <a href="/schedule" className="btn w-full text-center">Schedule</a>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
