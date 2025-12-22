import { useState } from 'react';
import { MEMBER_RATE, STANDARD_RATE } from '../utils/pricing';

interface MemberToggleProps {
  onToggle: (isMember: boolean) => void;
}

export default function MemberToggle({ onToggle }: MemberToggleProps) {
  const [isMember, setIsMember] = useState(false);
  const memberRate = MEMBER_RATE; // $1.75/lb
  const standardRate = STANDARD_RATE; // $2.25/lb
  const currentRate = isMember ? memberRate : standardRate;
  const savings = (standardRate - memberRate).toFixed(2);

  const handleToggle = (memberStatus: boolean) => {
    setIsMember(memberStatus);
    onToggle(memberStatus);
  };

  return (
    <div>
      {/* Member Toggle */}
      <div className="flex justify-center mb-4 sm:mb-6">
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
            Standard
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

      <div className="text-center mb-8 sm:mb-12">
        <p className="mb-2">
          <span className="text-2xl sm:text-3xl font-bold text-blue-600">${currentRate}</span>
          <span className="text-gray-600 ml-2 text-sm sm:text-base">per pound</span>
        </p>
        {!isMember && (
          <p className="text-xs sm:text-sm text-green-600 font-medium">
            (Save ${savings}/lb with membership!)
          </p>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
        {/* 10 lbs */}
        <article className="card p-4 sm:p-6 text-center">
          <h3 className="text-lg sm:text-xl font-bold text-brand-text mb-2">10 pounds</h3>
          <p className="mb-3 sm:mb-4">
            <span className="text-2xl sm:text-3xl font-black text-brand-text">${(10 * currentRate).toFixed(2)}</span>
          </p>
          <p className="text-gray-500 mb-3 sm:mb-4 text-sm sm:text-base">Perfect for weekly maintenance loads</p>
          <ul className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6 space-y-1 sm:space-y-2">
            <li>- Individual or light weekly loads</li>
            <li>- 24-hour turnaround</li>
            <li>- Professional wash, dry, and fold</li>
          </ul>
        </article>

        {/* 20 lbs */}
        <article className="card p-4 sm:p-6 text-center">
          <div className="inline-block bg-orange-100 text-brand-primaryDeep border border-orange-200 rounded-full px-3 py-1 text-xs font-bold mb-2 sm:mb-3">
            Most Popular
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-brand-text mb-2">20 pounds</h3>
          <p className="mb-3 sm:mb-4">
            <span className="text-2xl sm:text-3xl font-black text-brand-text">${(20 * currentRate).toFixed(2)}</span>
          </p>
          <p className="text-gray-500 mb-3 sm:mb-4 text-sm sm:text-base">Perfect for families and couples</p>
          <ul className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6 space-y-1 sm:space-y-2">
            <li>• Most requested service size</li>
            <li>• Regular laundry needs</li>
            <li>• Best value for most households</li>
          </ul>
        </article>

        {/* 30 lbs */}
        <article className="card p-4 sm:p-6 text-center">
          <h3 className="text-lg sm:text-xl font-bold text-brand-text mb-2">30 pounds</h3>
          <p className="mb-3 sm:mb-4">
            <span className="text-2xl sm:text-3xl font-black text-brand-text">${(30 * currentRate).toFixed(2)}</span>
          </p>
          <p className="text-gray-500 mb-3 sm:mb-4 text-sm sm:text-base">Best value for large households</p>
          <ul className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6 space-y-1 sm:space-y-2">
            <li>• Large families or bulk laundry</li>
            <li>• Maximum value with per-pound pricing</li>
            <li>• Great for busy weeks</li>
          </ul>
        </article>
      </div>
    </div>
  );
}