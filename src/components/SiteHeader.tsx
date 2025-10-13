import { useState, useEffect, useRef } from 'react';

interface SiteHeaderProps {
  session?: any;
  currentPath?: string;
}

export default function SiteHeader({ session, currentPath }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { href: "/services", label: "Services" },
    { href: "/pricing", label: "Pricing" },
    { href: "/service-areas", label: "Service Areas" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/laundromat-partners", label: "Partners" },
  ];

  const role = session?.user?.app_metadata?.role || 'customer';
  const dashboardHref = {
    admin: '/dashboard/admin',
    driver: '/dashboard/driver',
    laundromat_staff: '/dashboard/staff',
    customer: '/dashboard',
  }[role] || '/dashboard';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 hover:no-underline">
            <img src="/images/t shirt.PNG" alt="Bags of Laundry T-shirt icon" className="h-10 w-auto" />
            <img src="/images/bags of laundry logo - Copy.png" alt="Bags of Laundry logo" className="h-10 w-auto" />
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
            {!session && (
              <a href="/auth/login" className="btn-ghost">Sign In</a>
            )}
            
            {/* Schedule button - always visible */}
            <a href="/start-basic" className="btn">Schedule</a>
            
            {session && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-primary hover:bg-brand-primary/90 text-white transition-colors"
                  aria-label="User menu"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
                
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm text-gray-500">Signed in as</p>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {session.user?.user_metadata?.full_name || session.user?.email}
                      </p>
                    </div>
                    <a
                      href={dashboardHref}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Dashboard
                    </a>
                    <a
                      href="/api/auth/signout"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Sign Out
                    </a>
                  </div>
                )}
              </div>
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
            {!session && (
              <a href="/auth/login" className="btn-ghost">Sign In</a>
            )}
            
            {/* Schedule button - always visible */}
            <a href="/start-basic" className="btn w-full text-center">Schedule</a>
            
            {session && (
              <>
                <div className="text-sm text-brand-text border-t pt-4">
                  Signed in as {session.user?.user_metadata?.full_name || session.user?.email?.split("@")[0]}
                </div>
                <a
                  href={dashboardHref}
                  className={
                    currentPath === "/dashboard"
                      ? "text-brand-primary font-semibold"
                      : "text-brand-text hover:text-brand-primary transition"
                  }
                >
                  Dashboard
                </a>
                <a href="/api/auth/signout" className="btn-ghost text-sm w-full text-left">Sign Out</a>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
