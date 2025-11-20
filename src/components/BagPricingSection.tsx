import { useState, useEffect } from 'react';
import { getBagWeightLimits } from '../utils/pricing';

export default function BagPricingSection() {
  const [isMember, setIsMember] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const weightLimits = getBagWeightLimits(isMember);

  const handleToggle = (memberStatus: boolean) => {
    if (memberStatus !== isMember) {
      setIsAnimating(true);
      setIsMember(memberStatus);
      
      // Reset animation after a brief delay
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  // WeightDisplay component for animated weight limits
  const WeightDisplay = ({ weight, bagType }: { weight: number; bagType: string }) => {
    const [displayWeight, setDisplayWeight] = useState(weight);
    
    useEffect(() => {
      if (displayWeight !== weight) {
        // Brief delay then update to new weight
        const timer = setTimeout(() => setDisplayWeight(weight), 150);
        return () => clearTimeout(timer);
      }
    }, [weight, displayWeight]);

    const benefitText = isMember && weight > getBagWeightLimits(false)[bagType as keyof typeof weightLimits];
    
    return (
      <div className="relative">
        <span 
          className={`text-sm sm:text-base transition-all duration-300 ${
            isAnimating ? 'scale-110' : 'scale-100'
          } ${
            isMember ? 'text-green-700 font-bold' : 'text-gray-500'
          }`}
        >
          Fits up to {displayWeight} lbs
        </span>
        {benefitText && (
          <div className={`absolute -top-6 left-0 right-0 text-xs text-green-600 font-medium transition-opacity duration-300 ${
            isAnimating ? 'opacity-100' : 'opacity-70'
          }`}>
            +{weight - getBagWeightLimits(false)[bagType as keyof typeof weightLimits]} lbs with membership!
          </div>
        )}
        {isAnimating && (
          <div className="absolute inset-0 bg-green-100 rounded animate-pulse opacity-20"></div>
        )}
      </div>
    );
  };

  return (
    <section className="py-8 sm:py-12 lg:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="section-title text-center text-brand-text mb-4 sm:mb-6">Fixed-Rate Bag Pricing</h2>
          
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
            <div className="w-full overflow-hidden" style={{ aspectRatio: '1' }}>
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
              <div className="mb-3 sm:mb-4">
                <WeightDisplay weight={weightLimits.small} bagType="small" />
              </div>
              <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">
                Perfect for individuals or light loads. One fixed price regardless of actual weight within limits.
              </p>
              <a href="/schedule?bag=small" className="btn-alt w-full text-center">Choose Small Bag</a>
            </div>
          </article>

          <article className="card overflow-hidden">
            <div className="w-full overflow-hidden" style={{ aspectRatio: '1' }}>
              <img
                src="https://images.unsplash.com/photo-1582735689369-4fe89db7114c?q=80&w=600&auto=format&fit=crop"
                alt="Medium laundry bag"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4 sm:p-6 text-center">
              <h3 className="text-lg sm:text-xl font-bold text-brand-text mb-2">Medium Bag</h3>
              <p className="mb-2">
                <span className="text-3xl sm:text-4xl font-black text-brand-text">$55</span>
              </p>
              <div className="mb-3 sm:mb-4">
                <WeightDisplay weight={weightLimits.medium} bagType="medium" />
              </div>
              <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">
                Great for families and regular laundry loads. Fixed pricing with generous capacity limits.
              </p>
              <a href="/schedule?bag=medium" className="btn-alt w-full text-center">Choose Medium Bag</a>
            </div>
          </article>

          <article className="card overflow-hidden">
            <div className="w-full overflow-hidden" style={{ aspectRatio: '1' }}>
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
              <div className="mb-3 sm:mb-4">
                <WeightDisplay weight={weightLimits.large} bagType="large" />
              </div>
              <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">
                Best for large households or bulk loads. Fixed price with our largest capacity allowance.
              </p>
              <a href="/schedule?bag=large" className="btn-alt w-full text-center">Choose Large Bag</a>
            </div>
          </article>
        </div>
        <div className="text-center mt-8">
          <p className="text-xs text-gray-500 mb-4">
            Open-bag / overstuffed fee: $10 (we'll text first). Bag capacity estimates vary by fabric and size.
          </p>
          
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-800 mx-auto"
          >
            <span>How It Works</span>
            <span className={`transform transition-transform ${showHowItWorks ? 'rotate-180' : ''}`}>
              ↓
            </span>
          </button>
          
          {showHowItWorks && (
            <div className="mt-4 p-4 bg-white border-2 border-brand-primary rounded-lg text-left max-w-lg mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-2xl">💡</div>
                <h3 className="text-lg font-bold text-brand-text">How it works</h3>
              </div>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-3">
                  <span className="font-bold text-brand-primary">1.</span>
                  <span>We pick up your laundry at your door</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-bold text-brand-primary">2.</span>
                  <span>Your items are weighed at our facility</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-bold text-brand-primary">3.</span>
                  <span>You're charged $2.25 per pound or $1.75 for <a href="/membership" className="text-blue-600 hover:text-blue-800 underline">members</a> (minimum $35)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-bold text-brand-primary">4.</span>
                  <span>Clean, folded laundry delivered back to you</span>
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}