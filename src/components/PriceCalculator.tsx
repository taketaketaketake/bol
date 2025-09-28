import { useState, useEffect } from 'react';

interface PriceCalculatorProps {
  isMember: boolean;
}

export default function PriceCalculator({ isMember }: PriceCalculatorProps) {
  const memberRate = 1.99;
  const standardRate = 2.25;
  const currentRate = isMember ? memberRate : standardRate;
  const [estimate, setEstimate] = useState('$45.00');

  useEffect(() => {
    const calculatePrice = () => {
      const lbsInput = document.getElementById('lbs') as HTMLInputElement;
      const rushCheckbox = document.getElementById('rush') as HTMLInputElement;
      const ecoCheckbox = document.getElementById('eco') as HTMLInputElement;
      const hangCheckbox = document.getElementById('hang') as HTMLInputElement;

      if (!lbsInput || !rushCheckbox || !ecoCheckbox || !hangCheckbox) return;

      const lbs = Math.max(0, parseFloat(lbsInput.value) || 0);
      const rate = currentRate;
      const rush = rushCheckbox.checked ? 10 : 0;
      const eco = ecoCheckbox.checked ? 0.10 : 0;
      const hang = hangCheckbox.checked ? 0.25 : 0;

      let subtotal = lbs * (rate + eco + hang) + rush;
      if (subtotal < 35) subtotal = 35; // minimum

      setEstimate(`$${subtotal.toFixed(2)}`);
    };

    // Add event listeners
    const inputs = ['lbs', 'rush', 'eco', 'hang'];
    inputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', calculatePrice);
        element.addEventListener('change', calculatePrice);
      }
    });

    // Initial calculation
    calculatePrice();

    // Cleanup
    return () => {
      inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          element.removeEventListener('input', calculatePrice);
          element.removeEventListener('change', calculatePrice);
        }
      });
    };
  }, [currentRate]);

  return (
    <div className="card p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

        <div>
          <label htmlFor="lbs" className="block text-sm font-bold text-brand-text mb-2">Estimated pounds</label>
          <input
            id="lbs"
            type="number"
            min="1"
            defaultValue="20"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary"
          />
          <p className="text-xs text-gray-500 mt-2">Tip: 1 kitchen trash bag ≈ 12–18 lb</p>
        </div>

        <div>
          <div className="mb-3 sm:mb-4">
            <label className="block text-sm font-bold text-brand-text mb-2">Current rate</label>
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-base sm:text-lg font-bold text-brand-text">${currentRate}/lb</span>
              <span className="text-xs sm:text-sm text-gray-500 ml-2">
                {isMember ? 'Member pricing' : 'Standard pricing'}
              </span>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <label className="flex items-center gap-3">
              <input id="rush" type="checkbox" className="rounded" />
              <span className="text-xs sm:text-sm text-gray-500">Add rush (+$10)</span>
            </label>
            <label className="flex items-center gap-3">
              <input id="eco" type="checkbox" className="rounded" />
              <span className="text-xs sm:text-sm text-gray-500">Eco detergent (+$0.10/lb)</span>
            </label>
            <label className="flex items-center gap-3">
              <input id="hang" type="checkbox" className="rounded" />
              <span className="text-xs sm:text-sm text-gray-500">Hang-dry (+$0.25/lb)</span>
            </label>
          </div>
        </div>

        <div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 sm:p-6">
            <div className="inline-block bg-orange-100 text-brand-primaryDeep border border-orange-200 rounded-full px-3 py-1 text-xs font-bold mb-3">Estimated total</div>
            <p className="text-2xl sm:text-3xl font-black text-brand-text mb-2">{estimate}</p>
            <p className="text-xs text-gray-500 mb-4">Includes $35 minimum if applicable. Taxes not included.</p>
            <a href="/schedule" className="bg-brand-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-primaryDeep transition-all w-full text-center block">Schedule Pickup</a>
          </div>
        </div>
      </div>
    </div>
  );
}