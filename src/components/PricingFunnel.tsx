import { useState, useEffect } from 'react';
import { getBagWeightLimits } from '../utils/pricing';

export default function PricingFunnel() {
  const [pounds, setPounds] = useState(20);
  const [showComparison, setShowComparison] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const standardRate = 2.25;
  const memberRate = 1.75;
  const minimum = 35;

  // Calculate costs
  const standardCost = Math.max(pounds * standardRate, minimum);
  const memberCost = Math.max(pounds * memberRate, minimum);
  const savings = standardCost - memberCost;
  const monthlySavings = savings * 4; // Assuming weekly service
  const yearlyScore = monthlySavings * 12;

  const memberWeights = getBagWeightLimits(true);
  const nonMemberWeights = getBagWeightLimits(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowComparison(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleGetStarted = () => {
    setCurrentStep(2);
  };

  const Step1 = () => (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white py-12 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block bg-orange-100 text-orange-600 px-4 py-2 rounded-full text-sm font-bold mb-6">
            🎯 FREE SAVINGS CALCULATOR
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6">
            Save <span className="text-yellow-300">30%+</span> on<br/>
            Your Laundry Costs
          </h1>
          <p className="text-xl sm:text-2xl mb-8 opacity-90">
            See exactly how much Detroit families save with our membership
          </p>
          
          {/* Calculator Preview */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 text-gray-900 max-w-2xl mx-auto shadow-2xl">
            <div className="grid sm:grid-cols-2 gap-6 text-center">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1">Standard Pricing</div>
                <div className="text-3xl font-black text-red-600">${standardCost.toFixed(2)}</div>
                <div className="text-sm text-gray-500">per {pounds}-lb load</div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 ring-2 ring-green-400">
                <div className="text-sm text-gray-600 mb-1">Member Pricing</div>
                <div className="text-3xl font-black text-green-600">${memberCost.toFixed(2)}</div>
                <div className="text-sm text-green-600 font-bold">Save ${savings.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <button
            onClick={handleGetStarted}
            className="mt-8 bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-8 py-4 rounded-xl text-xl font-bold shadow-lg transform hover:scale-105 transition-all"
          >
            🎯 Calculate My Savings
          </button>
          <p className="text-sm mt-3 opacity-75">Takes 30 seconds • No email required</p>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <p className="text-gray-600 mb-4">Trusted by 2,000+ Detroit families</p>
            <div className="flex justify-center items-center gap-8 text-2xl">
              ⭐⭐⭐⭐⭐ <span className="text-lg text-gray-600">4.9/5 rating</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div className="bg-white p-6 rounded-xl shadow">
              <div className="text-3xl font-black text-green-600 mb-2">$73</div>
              <p className="text-gray-600">Average monthly savings</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow">
              <div className="text-3xl font-black text-blue-600 mb-2">2hr</div>
              <p className="text-gray-600">Time saved per week</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow">
              <div className="text-3xl font-black text-purple-600 mb-2">24hr</div>
              <p className="text-gray-600">Turnaround time</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );

  const Step2 = () => (
    <>
      {/* Calculator Section */}
      <section className="py-12 sm:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
              Your Personalized Savings Calculator
            </h2>
            <p className="text-xl text-gray-600">
              Adjust the weight to see your exact savings
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 sm:p-8 border-2 border-blue-200">
            {/* Weight Slider */}
            <div className="mb-8 text-center">
              <label className="block text-lg font-bold text-gray-900 mb-4">
                How many pounds of laundry per week?
              </label>
              <div className="max-w-md mx-auto">
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={pounds}
                  onChange={(e) => setPounds(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-2">
                  <span>10 lbs</span>
                  <span className="text-2xl font-bold text-blue-600">{pounds} lbs</span>
                  <span>50 lbs</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                💡 Average family uses 15-25 lbs per week
              </p>
            </div>

            {/* Comparison Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Standard Pricing */}
              <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                <div className="text-center">
                  <div className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold mb-4">
                    Standard Rate
                  </div>
                  <div className="text-4xl font-black text-gray-900 mb-2">
                    ${standardCost.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 mb-4">per {pounds}-lb load</div>
                  <div className="text-lg text-gray-600 mb-4">
                    ${standardRate}/lb rate
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Bag Capacity:</div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>Small: {nonMemberWeights.small} lbs → $35</div>
                      <div>Medium: {nonMemberWeights.medium} lbs → $55</div>
                      <div>Large: {nonMemberWeights.large} lbs → $85</div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="text-2xl font-bold text-gray-900">
                      ${(standardCost * 4).toFixed(0)}/mo
                    </div>
                    <div className="text-sm text-gray-500">monthly cost</div>
                  </div>
                </div>
              </div>

              {/* Member Pricing */}
              <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-400 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="bg-green-400 text-white px-4 py-1 rounded-full text-sm font-bold">
                    💰 BEST VALUE
                  </div>
                </div>
                <div className="text-center">
                  <div className="inline-block bg-gradient-to-r from-green-100 to-blue-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold mb-4">
                    Member Rate
                  </div>
                  <div className="text-4xl font-black text-green-600 mb-2">
                    ${memberCost.toFixed(2)}
                  </div>
                  <div className="text-sm font-bold text-green-600 mb-4">
                    SAVE ${savings.toFixed(2)} per load!
                  </div>
                  <div className="text-lg text-gray-600 mb-4">
                    ${memberRate}/lb rate
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4 mb-4 border border-green-200">
                    <div className="text-sm font-semibold text-green-700 mb-2">Enhanced Bag Capacity:</div>
                    <div className="space-y-1 text-sm text-green-600">
                      <div>Small: {memberWeights.small} lbs → $35</div>
                      <div>Medium: {memberWeights.medium} lbs → $55</div>
                      <div>Large: {memberWeights.large} lbs → $85</div>
                    </div>
                  </div>
                  
                  <div className="border-t border-green-200 pt-4">
                    <div className="text-2xl font-bold text-green-600">
                      ${(memberCost * 4).toFixed(0)}/mo
                    </div>
                    <div className="text-sm text-green-600 font-bold">
                      Save ${monthlySavings.toFixed(0)}/month!
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Savings Highlight */}
            <div className="mt-8 text-center">
              <div className="bg-yellow-100 border border-yellow-300 rounded-xl p-6">
                <div className="text-2xl font-black text-yellow-800 mb-2">
                  🎉 You Could Save ${monthlySavings.toFixed(0)} Per Month!
                </div>
                <div className="text-lg text-yellow-700">
                  That's <strong>${yearlyScore.toFixed(0)} per year</strong> back in your pocket
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Urgency Section */}
      <section className="py-12 bg-gradient-to-r from-orange-500 to-red-500 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-6">
            🔥 Limited Time: Save $20 on Membership
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join in the next 24 hours and get your first month for just $29.99
          </p>
          
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <a 
              href="/membership" 
              className="bg-white text-gray-900 px-8 py-4 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all block"
            >
              🚀 Start Membership ($29.99)
            </a>
            <a 
              href="/schedule" 
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-8 py-4 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all block"
            >
              📅 Schedule First Pickup
            </a>
          </div>
          
          <p className="text-sm mt-4 opacity-75">
            💰 30-day money-back guarantee • Cancel anytime
          </p>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
              Why Detroit Families Choose Our Membership
            </h2>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 text-center shadow-lg">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Save 30% Per Load</h3>
              <p className="text-gray-600">Pay $1.75/lb instead of $2.25/lb. More capacity in bag pricing too.</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 text-center shadow-lg">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Priority Scheduling</h3>
              <p className="text-gray-600">Get first pick of time slots and rush service priority.</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 text-center shadow-lg">
              <div className="text-4xl mb-4">🎁</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Exclusive Perks</h3>
              <p className="text-gray-600">Free branded bag, monthly rush credit, and member-only pricing.</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 text-center shadow-lg">
              <div className="text-4xl mb-4">🚚</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Free Pickup & Delivery</h3>
              <p className="text-gray-600">Always included. Door-to-door service across Detroit metro.</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 text-center shadow-lg">
              <div className="text-4xl mb-4">⏰</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">24-Hour Turnaround</h3>
              <p className="text-gray-600">Pick up today, get it back tomorrow. Perfect for busy schedules.</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 text-center shadow-lg">
              <div className="text-4xl mb-4">✨</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Professional Quality</h3>
              <p className="text-gray-600">Expert wash, dry, and fold. Clothes come back better than new.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-br from-blue-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-black mb-6">
            Ready to Save ${monthlySavings.toFixed(0)}/Month?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join 2,000+ Detroit families who've already made the switch
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
            <a 
              href="/membership" 
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-8 py-4 rounded-xl text-lg font-bold shadow-lg flex-1 text-center transform hover:scale-105 transition-all"
            >
              🎯 Get Membership Now
            </a>
            <a 
              href="/schedule" 
              className="bg-white bg-opacity-20 hover:bg-opacity-30 border-2 border-white text-white px-8 py-4 rounded-xl text-lg font-bold flex-1 text-center transform hover:scale-105 transition-all"
            >
              📞 Schedule Pickup
            </a>
          </div>
          
          <div className="mt-8 grid sm:grid-cols-3 gap-4 text-center text-sm opacity-75">
            <div>✅ No long-term contracts</div>
            <div>✅ 30-day money back</div>
            <div>✅ Cancel anytime</div>
          </div>
        </div>
      </section>
    </>
  );

  return (
    <div className="min-h-screen">
      {currentStep === 1 ? <Step1 /> : <Step2 />}
    </div>
  );
}