import { useState, useEffect, useRef } from 'react';

interface ZipCheckerProps {
  mapboxToken?: string;
}

export default function ZipChecker({ mapboxToken }: ZipCheckerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [serviceAreaResult, setServiceAreaResult] = useState<{
    isServiced: boolean;
    message: string;
  } | null>(null);

  // ZIP autocomplete effect
  useEffect(() => {
    if (!query || query.length < 2 || !mapboxToken) {
      setSuggestions([]);
      return;
    }

    const debounce = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query
          )}.json?access_token=${mapboxToken}&country=US&types=postcode&limit=5&bbox=-90.4180,41.6962,-82.4137,48.3063`
        );
        const data = await res.json();
        setSuggestions(data.features || []);
      } catch (err) {
        console.error("Mapbox ZIP search failed:", err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, mapboxToken]);

  const handleSelect = (zip: string) => {
    setQuery(zip);
    setSuggestions([]);
    setServiceAreaResult(null);
  };

  const checkServiceArea = () => {
    console.log('Check button clicked!', query); // Debug log
    if (!query.trim()) {
      console.log('Query is empty, returning');
      return;
    }

    // Comprehensive service ZIP codes for Detroit metro area
    const serviceZips = [
      // Detroit Core
      '48226', '48201', '48216', '48202', '48207', '48208', '48209', '48210', '48211', '48212', '48213', '48214', '48215', '48217', '48219', '48221', '48222', '48223', '48224', '48227', '48228', '48233', '48234', '48235', '48238', '48243', '48244', '48255', '48260', '48264', '48265', '48266', '48267', '48268', '48269', '48272', '48275', '48277', '48278', '48279', '48288',

      // Royal Oak & Ferndale
      '48067', '48073', '48220', '48237',

      // Dearborn & Dearborn Heights
      '48124', '48125', '48126', '48127', '48128',

      // Grosse Pointe Area
      '48230', '48236', '48215', '48224', '48236',

      // Warren & Sterling Heights
      '48089', '48091', '48092', '48088', '48093', '48310', '48311', '48312', '48313', '48314',

      // Southfield & Oak Park
      '48075', '48076', '48033', '48034', '48237',

      // Troy & Birmingham
      '48083', '48084', '48085', '48009', '48012', '48013', '48025', '48069', '48098',

      // Livonia & Westland
      '48150', '48152', '48154', '48185', '48186',

      // Canton & Plymouth
      '48187', '48188', '48170', '48174',

      // Additional Metro Detroit
      '48146', '48141', '48180', '48183', '48184', // Lincoln Park, Southgate, Wyandotte
      '48101', '48105', '48108', '48111', // Allen Park, Ann Arbor outskirts
      '48070', '48071', '48072', // Huntington Woods, Madison Heights
      '48030', '48038', '48039', // Hazel Park, Clinton Township
      '48066', '48065', // Roseville, Romeo
      '48021', '48026', '48035', // Eastpointe, Fraser, Mount Clemens
      '48045', '48047', '48048', // Harrison Township, New Baltimore, Shelby Township
    ];

    const zipCode = query.replace(/\D/g, '').slice(0, 5); // Get first 5 digits only
    const isServiced = serviceZips.includes(zipCode);

    console.log('Checking ZIP:', zipCode, 'Is serviced:', isServiced); // Debug log

    setServiceAreaResult({
      isServiced,
      message: isServiced
        ? `🎉 Great! We deliver to ${zipCode}. Schedule your pickup above.`
        : `📍 Sorry, we don't currently serve ${zipCode}. We're expanding to new areas regularly - check back soon!`
    });
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkServiceArea();
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter your ZIP code (e.g., 48226)"
          className="w-full px-4 py-3 sm:px-5 sm:py-4 pr-20 sm:pr-24 rounded-2xl border border-gray-300 shadow-sm focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary text-gray-900 placeholder-gray-500 text-base sm:text-lg transition-all"
          maxLength={10}
        />
        <button
          type="button"
          onClick={checkServiceArea}
          disabled={!query.trim()}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-brand-primary text-white px-4 py-2 sm:px-6 sm:py-2 rounded-xl text-sm sm:text-base font-semibold hover:bg-brand-primaryDeep disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-manipulation"
        >
          Check
        </button>
      </div>

      {/* Autocomplete Dropdown */}
      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-gray-800 touch-manipulation"
              onClick={() => handleSelect(s.text)}
            >
              {s.text}
            </div>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow p-3 text-sm text-gray-500 z-50">
          Searching...
        </div>
      )}

      {/* Service area result */}
      {serviceAreaResult && (
        <div className={`absolute top-full left-0 right-0 mt-2 border rounded-xl shadow-lg p-4 z-50 ${
          serviceAreaResult.isServiced
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">
              {serviceAreaResult.isServiced ? '🎉' : '📍'}
            </span>
            <div className="flex-1">
              <p className="font-medium text-sm sm:text-base mb-2">
                {serviceAreaResult.message}
              </p>
              {serviceAreaResult.isServiced ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      // Scroll to form
                      const form = document.querySelector('form[action="/start-basic"]');
                      if (form) {
                        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const firstInput = form.querySelector('input');
                        if (firstInput) {
                          setTimeout(() => firstInput.focus(), 500);
                        }
                      }
                    }}
                    className="inline-block bg-brand-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-primaryDeep transition-all touch-manipulation text-center"
                  >
                    Start Order →
                  </a>
                  <a
                    href="/pricing"
                    className="inline-block bg-white text-brand-primary border border-brand-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-primary hover:text-white transition-all touch-manipulation text-center"
                  >
                    View Pricing
                  </a>
                </div>
              ) : (
                <div className="text-xs text-amber-600">
                  <p>We're actively expanding our service area. Follow us for updates!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-sm text-gray-500 mt-3">
        We'll instantly tell you if you're in our service area
      </p>
    </div>
  );
}