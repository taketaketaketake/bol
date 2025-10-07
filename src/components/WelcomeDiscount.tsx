import { useState, useEffect } from 'react';

export default function WelcomeDiscount() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if user has already converted (permanent)
    const hasConverted = localStorage.getItem('user-converted');
    // Check if shown this session (temporary)
    const shownThisSession = sessionStorage.getItem('discount-shown-this-session');
    
    // Show popup if user hasn't converted AND hasn't seen it this session
    if (!hasConverted && !shownThisSession) {
      setTimeout(() => setShow(true), 3000); // Show after 3 seconds
      // Mark as shown this session
      sessionStorage.setItem('discount-shown-this-session', 'true');
    }
  }, []);

  const handleClose = () => {
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md relative shadow-2xl border-4 border-orange-200 ring-2 ring-orange-100" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-text mb-4">Welcome!</h2>
          <p className="text-brand-text mb-4 text-lg">
            Get <span className="text-brand-primary font-bold text-2xl">10% off</span> your first order!
          </p>
          <p className="text-brand-muted mb-6">
            Use code <span className="bg-brand-primary/10 text-brand-primary font-mono font-bold px-3 py-1 rounded text-lg">FIRST10</span> at checkout
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <a href="/start-basic" className="btn flex-1 text-center">Start Your Order</a>
            <button onClick={handleClose} className="btn-alt flex-1">Maybe Later</button>
          </div>
        </div>
      </div>
    </div>
  );
}
