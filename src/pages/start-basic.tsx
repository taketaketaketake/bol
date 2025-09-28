import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { readWizard, writeWizard } from "../utils/wizard.server";
import { useEffect, useRef, useState } from "react";

const Schema = z.object({
  line1: z.string().min(3),
  dropoffLine1: z.string().optional(),
  dropoffDate: z.string().optional(),
  sameAsPickup: z.boolean().default(true),
  date: z.string().min(10), // YYYY-MM-DD
  phone: z.string().min(7)
}).refine((data) => {
  if (!data.sameAsPickup) {
    return (
      data.dropoffLine1 &&
      data.dropoffLine1.length >= 3 &&
      data.dropoffDate &&
      data.dropoffDate.length >= 10
    );
  }
  return true;
}, {
  message: "Drop-off address and date are required when different from pickup",
  path: ["dropoffLine1"]
});

export async function loader({ request }: LoaderFunctionArgs) {
  const w = await readWizard(request);
  return json({ w });
}

export async function action({ request }: ActionFunctionArgs) {
  const fd = await request.formData();
  
  const data = {
    line1: String(fd.get("address") || fd.get("line1") || ""),
    dropoffLine1: String(fd.get("dropoffLine1") || ""),
    dropoffDate: String(fd.get("dropoffDate") || ""),
    sameAsPickup: fd.get("sameAsPickup") !== null ? fd.get("sameAsPickup") === "on" : true,
    date: String(fd.get("date") || ""),
    phone: String(fd.get("phone") || "")
  };
  
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    return json({ 
      error: parsed.error.issues[0]?.message || "Please complete all fields." 
    }, { status: 400 });
  }

  return writeWizard(request, {
    address: { line1: parsed.data.line1 },
    dropoffAddress: parsed.data.sameAsPickup ? null : {
      line1: parsed.data.dropoffLine1!,
      date: parsed.data.dropoffDate!
    },
    date: parsed.data.date,
    phone: parsed.data.phone
  }, "/order-type");
}

export default function StartBasic() {
  const { w } = useLoaderData<typeof loader>();
  const action = useActionData<typeof action>();
  
  // Refs for pickup + dropoff
  const addressInputRef = useRef<HTMLInputElement>(null);
  const dropoffAddressInputRef = useRef<HTMLInputElement>(null);

  const [sameAsPickup, setSameAsPickup] = useState(true);
  
  // Get today's date as minimum
  const today = new Date();
  const minDate = today.toISOString().split('T')[0];

  useEffect(() => {
    const setupAddressAutocomplete = (
      input: HTMLInputElement,
      linkedPostalRef?: React.RefObject<HTMLInputElement>
    ) => {
      if (input.dataset.autocompleteInitialized) return;
      input.dataset.autocompleteInitialized = "true";

      let debounceTimer: NodeJS.Timeout;
      let suggestionsList: HTMLElement | null = null;

      const removeSuggestions = () => {
        if (suggestionsList) {
          suggestionsList.remove();
          suggestionsList = null;
        }
      };

      const showSuggestions = (suggestions: any[], showNoResults = false) => {
        removeSuggestions();
        suggestionsList = document.createElement("div");
        suggestionsList.className =
          "absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto mt-1";

        if (suggestions.length === 0 && showNoResults) {
          const noResultsItem = document.createElement("div");
          noResultsItem.className = "px-4 py-3 text-gray-500 text-sm";
          noResultsItem.textContent =
            "No addresses found. Service area limited to Michigan.";
          suggestionsList.appendChild(noResultsItem);
        } else if (suggestions.length > 0) {
          suggestions.forEach((suggestion: any) => {
            const item = document.createElement("div");
            item.className =
              "px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0";
            item.textContent = suggestion.place_name;

            item.addEventListener("click", () => {
              input.value = suggestion.place_name;
              removeSuggestions();

              // Auto-fill postal code is no longer needed
            });

            suggestionsList!.appendChild(item);
          });
        } else {
          return; // Don't show empty dropdown
        }

        input.parentElement!.style.position = "relative";
        input.parentElement!.appendChild(suggestionsList);
      };

      const searchAddresses = async (query: string) => {
        if (query.length < 3) {
          removeSuggestions();
          return;
        }
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
              query
            )}.json?access_token=pk.eyJ1IjoidGFrZS1kZXRyb2l0LXRlY2giLCJhIjoiY2szaGR2ZHpqMDF6NzNucGd4NTBmZTJ6ciJ9.t8nObId6SpX-Kw5AfT5SoA&country=US&types=address,poi&limit=5&bbox=-90.4180,41.6962,-82.4137,48.3063`
          );
          const data = await response.json();
          showSuggestions(data.features || [], query.length >= 10);
        } catch (error) {
          console.error("Address search error:", error);
        }
      };

      input.addEventListener("input", (e) => {
        const query = (e.target as HTMLInputElement).value;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => searchAddresses(query), 300);
      });

      input.addEventListener("blur", () => {
        setTimeout(removeSuggestions, 150);
      });
    };

    const setupPostalAutocomplete = (input: HTMLInputElement) => {
      if (input.dataset.autocompleteInitialized) return;
      input.dataset.autocompleteInitialized = "true";

      let debounceTimer: NodeJS.Timeout;
      let suggestionsList: HTMLElement | null = null;

      const removeSuggestions = () => {
        if (suggestionsList) {
          suggestionsList.remove();
          suggestionsList = null;
        }
      };

      const showSuggestions = (suggestions: any[], showNoResults = false) => {
        removeSuggestions();
        suggestionsList = document.createElement("div");
        suggestionsList.className =
          "absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto mt-1";

        if (suggestions.length === 0 && showNoResults) {
          const noResultsItem = document.createElement("div");
          noResultsItem.className = "px-4 py-3 text-gray-500 text-sm";
          noResultsItem.textContent =
            "No ZIP codes found. Service area limited to Michigan.";
          suggestionsList.appendChild(noResultsItem);
        } else if (suggestions.length > 0) {
          suggestions.forEach((suggestion: any) => {
            const item = document.createElement("div");
            item.className =
              "px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0";
            item.textContent = suggestion.text;

            item.addEventListener("click", () => {
              input.value = suggestion.text;
              removeSuggestions();
            });

            suggestionsList!.appendChild(item);
          });
        } else {
          return; // Don't show empty dropdown
        }

        input.parentElement!.style.position = "relative";
        input.parentElement!.appendChild(suggestionsList);
      };

      const searchPostalCodes = async (query: string) => {
        if (query.length < 2) {
          removeSuggestions();
          return;
        }
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
              query
            )}.json?access_token=pk.eyJ1IjoidGFrZS1kZXRyb2l0LXRlY2giLCJhIjoiY2szaGR2ZHpqMDF6NzNucGd4NTBmZTJ6ciJ9.t8nObId6SpX-Kw5AfT5SoA&country=US&types=postcode&limit=5&bbox=-90.4180,41.6962,-82.4137,48.3063`
          );
          const data = await response.json();
          showSuggestions(data.features || [], query.length >= 3);
        } catch (error) {
          console.error("Postal code search error:", error);
        }
      };

      input.addEventListener("input", (e) => {
        const query = (e.target as HTMLInputElement).value;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => searchPostalCodes(query), 300);
      });

      input.addEventListener("blur", () => {
        setTimeout(removeSuggestions, 150);
      });
    };

    if (addressInputRef.current)
      setupAddressAutocomplete(addressInputRef.current);
    if (dropoffAddressInputRef.current)
      setupAddressAutocomplete(dropoffAddressInputRef.current);
  }, [sameAsPickup]);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                1
              </div>
              <span className="ml-2 text-sm font-medium text-blue-600">Schedule</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center font-semibold text-sm">
                2
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">Service</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center font-semibold text-sm">
                3
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">Add-ons</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center font-semibold text-sm">
                4
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">Details</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center font-semibold text-sm">
                5
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">Payment</span>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Where & when should we pick up?
          </h1>
          <p className="text-gray-600">
            Enter your pickup details to get started with your laundry service
          </p>
        </div>

        {/* Error Message */}
        {action?.error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-700 font-medium">{action.error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <Form method="post" className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            
            {/* Pickup Address Section */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Pickup Address
              </label>
              <input 
                ref={addressInputRef}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500"
                name="line1" 
                placeholder="Enter your street address" 
                defaultValue={w.address?.line1} 
                required 
              />
              <p className="text-xs text-gray-500 mt-1">
                We'll pick up from this location during your selected time window
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Pickup Date
                </label>
                <input 
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900"
                  type="date" 
                  name="date" 
                  min={minDate}
                  defaultValue={w.date} 
                  required 
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Mobile Number
                </label>
                <input 
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500"
                  name="phone" 
                  type="tel"
                  placeholder="(555) 123-4567" 
                  defaultValue={w.phone} 
                  required 
                />
              </div>
            </div>
          </div>

          {/* Same as Pickup Checkbox */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="sameAsPickup"
                name="sameAsPickup"
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                checked={sameAsPickup}
                onChange={(e) => setSameAsPickup(e.target.checked)}
              />
              <label htmlFor="sameAsPickup" className="ml-3 text-sm font-medium text-gray-900">
                Drop-off at same location as pickup
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2 ml-7">
              Uncheck this if you need delivery to a different address
            </p>
          </div>

          {/* Drop-off Section */}
          {!sameAsPickup && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Drop-off Address</h3>
              
              {/* Drop-off Address */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Drop-off Address
                </label>
                <input 
                  ref={dropoffAddressInputRef}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500"
                  name="dropoffLine1" 
                  placeholder="Enter drop-off street address" 
                  defaultValue={w.dropoffAddress?.line1} 
                  required={!sameAsPickup}
                />
                <p className="text-xs text-gray-500 mt-1">
                  We'll deliver your clean laundry to this location
                </p>
              </div>

              {/* Drop-off Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Drop-off Date
                </label>
                <input 
                  type="date"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 sm:max-w-xs"
                  name="dropoffDate" 
                  min={minDate}
                  defaultValue={w.dropoffAddress?.date} 
                  required={!sameAsPickup}
                />
                <p className="text-xs text-gray-500 mt-1">
                  When would you like your clean laundry delivered?
                </p>
              </div>
            </div>
          )}

          {/* Service Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Quick & Convenient</h3>
                <p className="text-sm text-gray-600 mb-2">
                  We'll text you 30 minutes before pickup and provide real-time updates throughout the process.
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>• 24-hour turnaround</span>
                  <span>• $35 minimum order</span>
                  <span>• Free pickup & delivery</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              type="submit"
              className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              Continue to Services
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            <a 
              href="/pricing" 
              className="bg-white text-gray-700 border-2 border-gray-300 px-6 py-4 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              View Pricing
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
}