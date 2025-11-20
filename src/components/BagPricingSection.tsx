import { useState } from 'react';
import { getBagWeightLimits } from '../utils/pricing';

export default function BagPricingSection() {
  const [isMember, setIsMember] = useState(false);
  
  const weightLimits = getBagWeightLimits(isMember);

  const handleToggle = (memberStatus: boolean) => {
    setIsMember(memberStatus);
  };

  return (
    <section className="py-8 sm:py-12 lg:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="section-title text-center text-brand-text mb-4 sm:mb-6">Per bag pricing</h2>
          
          {/* Member Toggle */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center bg-white rounded-xl p-1 shadow-sm border-2 border-gray-200 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleToggle(false)}
                style={{
                  backgroundColor: !isMember ? '#2563eb' : 'transparent',
                  color: !isMember ? 'white' : '#6b7280'
                }}
                className={`px-4 py-2 sm:px-6 sm:py-2 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base flex-1 sm:flex-none ${
                  !isMember ? 'shadow-sm' : 'hover:text-gray-800'
                }`}
              >
                Non-Member
              </button>
              <button
                type="button"
                onClick={() => handleToggle(true)}
                style={{
                  backgroundColor: isMember ? '#2563eb' : 'transparent',
                  color: isMember ? 'white' : '#6b7280'
                }}
                className={`px-4 py-2 sm:px-6 sm:py-2 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base flex-1 sm:flex-none ${
                  isMember ? 'shadow-sm' : 'hover:text-gray-800'
                }`}
              >
                Member
              </button>
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">

          <article className="card overflow-hidden">
            <div className="w-full h-48 overflow-hidden" style={{aspectRatio: "1 / 1"}}>
              <img
                src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600&auto=format&fit=crop"
                alt="Small laundry bag"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4 sm:p-6 text-center">
              <h3 className="text-lg sm:text-xl font-bold text-brand-text mb-2">Small Bag</h3>
              <p className="mb-2">
                <span className="text-3xl sm:text-4xl font-black text-brand-text">$35</span>
              </p>
              <p className="text-gray-500 mb-3 sm:mb-4 text-sm sm:text-base">
                Fits up to {weightLimits.small} lbs
              </p>
              <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">
                Perfect for individuals or light loads. One fixed price regardless of actual weight within limits.
              </p>
              <a href="/schedule?bag=small" className="btn-alt w-full text-center">Choose Small Bag</a>
            </div>
          </article>

          <article className="card overflow-hidden">
            <div className="relative">
              <div className="w-full h-48 overflow-hidden" style={{aspectRatio: "1 / 1"}}>
                <img
                  src="https://images.unsplash.com/photo-1582735689369-4fe89db7114c?q=80&w=600&auto=format&fit=crop"
                  alt="Medium laundry bag"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute top-4 left-4 bg-orange-100 text-brand-primaryDeep border border-orange-200 rounded-full px-3 py-1 text-xs font-bold">
                Most Popular
              </div>
            </div>
            <div className="p-4 sm:p-6 text-center">
              <h3 className="text-lg sm:text-xl font-bold text-brand-text mb-2">Medium Bag</h3>
              <p className="mb-2">
                <span className="text-3xl sm:text-4xl font-black text-brand-text">$55</span>
              </p>
              <p className="text-gray-500 mb-3 sm:mb-4 text-sm sm:text-base">
                Fits up to {weightLimits.medium} lbs
              </p>
              <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">
                Great for families and regular laundry loads. Fixed pricing with generous capacity limits.
              </p>
              <a href="/schedule?bag=medium" className="btn-alt w-full text-center">Choose Medium Bag</a>
            </div>
          </article>

          <article className="card overflow-hidden">
            <div className="w-full h-48 overflow-hidden" style={{aspectRatio: "1 / 1"}}>
              <img
                src="https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?q=80&w=600&auto=format&fit=crop"
                alt="Large laundry bag"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4 sm:p-6 text-center">
              <h3 className="text-lg sm:text-xl font-bold text-brand-text mb-2">Large Bag</h3>
              <p className="mb-2">
                <span className="text-3xl sm:text-4xl font-black text-brand-text">$85</span>
              </p>
              <p className="text-gray-500 mb-3 sm:mb-4 text-sm sm:text-base">
                Fits up to {weightLimits.large} lbs
              </p>
              <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">
                Best for large households or bulk loads. Fixed price with our largest capacity allowance.
              </p>
              <a href="/schedule?bag=large" className="btn-alt w-full text-center">Choose Large Bag</a>
            </div>
          </article>
        </div>
        <p className="text-xs text-gray-500 text-center mt-8">
          Open-bag / overstuffed fee: $10 (we'll text first). Bag capacity estimates vary by fabric and size.
        </p>
      </div>
    </section>
  );
}