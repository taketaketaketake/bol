import { useState, useEffect, useRef } from 'react';

interface ZipCheckerProps {
  mapboxToken: string;
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
    if (!query || query.length < 2) {
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
    if (!query.trim()) {
      return;
    }

    // Known service ZIP codes
    const serviceZips = [
      '48226', '48201', '48216', '48202', '48207', // Detroit
      '48067', '48073', // Royal Oak
      '48124', '48126', '48127', // Dearborn
      '48220', '48221', '48228', // Ferndale area
      '48236', '48230', // Grosse Pointe
      '48089', '48091', '48092', // Warren
      '48075', '48076', '48034', // Southfield
      '48083', '48084', '48085', // Troy
      '48150', '48152', '48154', // Livonia
      '48187', '48188', // Canton
    ];

    const zipCode = query.replace(/\D/g, '');
    const isServiced = serviceZips.includes(zipCode);

    setServiceAreaResult({
      isServiced,
      message: isServiced
        ? `Great! We deliver to ${zipCode}. Start your order above.`
        : `Sorry, we don't currently serve ${zipCode}. We're expanding soon!`
    });
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter your ZIP code to check availability"
        className="w-full px-4 py-3 sm:px-5 sm:py-4 rounded-2xl border border-gray-300 shadow-sm focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-gray-900 placeholder-gray-500 text-base sm:text-lg"
      />
      <button
        type="button"
        onClick={checkServiceArea}
        className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-2 sm:px-6 sm:py-2 rounded-xl text-sm sm:text-base font-semibold hover:bg-blue-700 transition-all touch-manipulation"
      >
        Check
      </button>

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
            : 'bg-orange-50 border-orange-200 text-orange-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {serviceAreaResult.isServiced ? '✅' : '⚠️'}
            </span>
            <span className="font-medium">
              {serviceAreaResult.message}
            </span>
          </div>
          {serviceAreaResult.isServiced && (
            <a
              href="#top-order"
              className="inline-block mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-all touch-manipulation"
            >
              Start Order →
            </a>
          )}
        </div>
      )}

      <p className="text-center text-sm text-gray-500 mt-3">
        We'll instantly tell you if you're in our service area
      </p>
    </div>
  );
}