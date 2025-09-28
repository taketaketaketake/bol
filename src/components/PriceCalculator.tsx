import { useState, useEffect } from 'react';

interface PriceCalculatorProps {
  isMember: boolean;
}

export default function PriceCalculator({ isMember }: PriceCalculatorProps) {
  const memberRate = 1.99;
  const standardRate = 2.25;
  const [selectedRate, setSelectedRate] = useState(standardRate);
  const [estimate, setEstimate] = useState('$45.00');
  const [pounds, setPounds] = useState(20);
  const [rush, setRush] = useState(false);
  const [eco, setEco] = useState(false);
  const [hang, setHang] = useState(false);

  useEffect(() => {
    const lbs = Math.max(0, pounds || 0);
    const rate = selectedRate;
    const rushFee = rush ? 10 : 0;
    const ecoFee = eco ? 0.10 : 0;
    const hangFee = hang ? 0.25 : 0;

    let subtotal = lbs * (rate + ecoFee + hangFee) + rushFee;
    if (subtotal < 35) subtotal = 35; // minimum

    setEstimate(`$${subtotal.toFixed(2)}`);
  }, [selectedRate, pounds, rush, eco, hang]);

  return (
    <div className="card p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

        <div>
          <label htmlFor="lbs" className="block text-sm font-bold text-brand-text mb-2">Estimated pounds</label>
          <input
            id="lbs"
            type="number"
            min="1"
            value={pounds}
            onChange={(e) => setPounds(parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary"
          />
          <p className="text-xs text-gray-500 mt-2">Tip: 1 kitchen trash bag ≈ 12–18 lb</p>
        </div>

        <div>
          <div className="mb-3 sm:mb-4">
            <label htmlFor="rateSelect" className="block text-sm font-bold text-brand-text mb-2">Pricing type</label>
            <select
              id="rateSelect"
              value={selectedRate}
              onChange={(e) => setSelectedRate(parseFloat(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary bg-white"
            >
              <option value={standardRate}>Standard - ${standardRate}/lb</option>
              <option value={memberRate}>Member - ${memberRate}/lb (Save $0.26/lb!)</option>
            </select>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <label className="flex items-center gap-3">
              <input
                id="rush"
                type="checkbox"
                checked={rush}
                onChange={(e) => setRush(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs sm:text-sm text-gray-500">Add rush (+$10)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                id="eco"
                type="checkbox"
                checked={eco}
                onChange={(e) => setEco(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs sm:text-sm text-gray-500">Eco detergent (+$0.10/lb)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                id="hang"
                type="checkbox"
                checked={hang}
                onChange={(e) => setHang(e.target.checked)}
                className="rounded"
              />
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