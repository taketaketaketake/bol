import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { readWizard, writeWizard } from "../utils/wizard.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const w = await readWizard(request);
  if (!w.orderType) return json({}, { status: 302, headers: { Location: "/order-type" } });
  return json({ w });
}

export async function action({ request }: ActionFunctionArgs) {
  const fd = await request.formData();
  const addons = {
    eco: fd.get("eco") === "on",
    hangDry: fd.get("hangDry") === "on",
    rush: fd.get("rush") === "on",
    notes: String(fd.get("notes") || "")
  };
  return writeWizard(request, { addons }, "/details");
}

const addOnOptions = [
  {
    id: "eco",
    name: "Eco-Friendly Detergent",
    description: "Hypoallergenic, plant-based detergent that's gentle on skin and environment",
    price: "+$0.10/lb",
    icon: (
      <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.5 2.5L16 4.5 14.5 3 16 1.5 17.5 3 16 4.5 17.5 6M13 13h4-4V8H9v5h4 0z" />
      </svg>
    ),
    popular: false
  },
  {
    id: "hangDry",
    name: "Hang-Dry Delicates",
    description: "Air-dry your delicate items to prevent shrinking and extend fabric life",
    price: "+$0.25/lb",
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    popular: true
  },
  {
    id: "rush",
    name: "Same-Day Rush Service",
    description: "Get your laundry back the same day (pickup before 10 AM required)",
    price: "+$10 flat fee",
    icon: (
      <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    popular: false,
    note: "Limited availability"
  }
];

export default function AddOns() {
  const { w } = useLoaderData<typeof loader>();

  // Local state for add-on selection (reactive)
  const [selectedAddons, setSelectedAddons] = useState({
    eco: false,
    hangDry: false,
    rush: false
  });

  const handleAddonChange = (id: string, checked: boolean) => {
    setSelectedAddons((prev) => ({ ...prev, [id]: checked }));
  };

  // Estimate calculation
  const lbs = 15; // base estimate load
  const baseRate = 2.25; // $/lb baseline
  let total = lbs * baseRate;
  if (selectedAddons.eco) total += lbs * 0.10;
  if (selectedAddons.hangDry) total += lbs * 0.25;
  if (selectedAddons.rush) total += 10;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">✓</div>
              <span className="ml-2 text-sm font-medium text-blue-600">Schedule</span>
            </div>
            <div className="w-8 h-0.5 bg-blue-600"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">✓</div>
              <span className="ml-2 text-sm font-medium text-blue-600">Service</span>
            </div>
            <div className="w-8 h-0.5 bg-blue-600"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">3</div>
              <span className="ml-2 text-sm font-medium text-blue-600">Add-ons</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center font-semibold text-sm">4</div>
              <span className="ml-2 text-sm font-medium text-gray-500">Details</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center font-semibold text-sm">5</div>
              <span className="ml-2 text-sm font-medium text-gray-500">Payment</span>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Any add-ons?</h1>
          <p className="text-gray-600">Customize your laundry service with these optional extras</p>
        </div>

        <Form method="post" className="space-y-6">
          {/* Add-on Options */}
          <div className="space-y-4">
            {addOnOptions.map((addon) => {
              const isChecked = selectedAddons[addon.id as keyof typeof selectedAddons];
              return (
                <label key={addon.id} className="cursor-pointer group block">
                  <div className={`
                    relative bg-white rounded-xl border-2 p-6 transition-all duration-300
                    hover:shadow-lg hover:-translate-y-0.5 group-hover:border-blue-300
                    ${isChecked ? "border-blue-500 shadow-md ring-2 ring-blue-100" : "border-gray-200 shadow-sm"}
                  `}>
                    {addon.popular && (
                      <div className="absolute -top-2 -right-2 z-10">
                        <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">Popular</span>
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        <input
                          type="checkbox"
                          name={addon.id}
                          checked={isChecked}
                          onChange={(e) => handleAddonChange(addon.id, e.target.checked)}
                          className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">{addon.icon}</div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-gray-900 text-lg">{addon.name}</h3>
                          <span className="font-bold text-gray-900">{addon.price}</span>
                        </div>
                        {addon.note && (
                          <p className="text-xs text-orange-600 font-medium">{addon.note}</p>
                        )}
                        <p className="text-sm text-gray-600">{addon.description}</p>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Notes Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <label className="block">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900">Special Instructions</h3>
              </div>
              <textarea
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                name="notes"
                rows={4}
                placeholder="Gate code, pet instructions, preferred pickup location, stain notes, etc."
                defaultValue={w.addons?.notes || ""}
              />
              <p className="text-xs text-gray-500 mt-2">Help us provide the best service by sharing any important details</p>
            </label>
          </div>

{/* Estimate Preview */}
<div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
  <div className="flex items-center gap-3 mb-3">
    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 002 2z"
        />
      </svg>
    </div>
    <h3 className="font-semibold text-gray-900">Estimated Total</h3>
  </div>

  {/* Line items */}
  <div className="space-y-1 text-sm">
    {selectedAddons.eco && (
      <div className="flex justify-between">
        <span>Eco-Friendly Detergent</span>
        <span>+$0.10/lb</span>
      </div>
    )}
    {selectedAddons.hangDry && (
      <div className="flex justify-between">
        <span>Hang-Dry Delicates</span>
        <span>+$0.25/lb</span>
      </div>
    )}
    {selectedAddons.rush && (
      <div className="flex justify-between">
        <span>Same-Day Rush</span>
        <span>+$10.00</span>
      </div>
    )}
  </div>

  {/* Total */}
  <div className="flex justify-between font-semibold border-t border-blue-200 pt-2 mt-2">
    <span>Total</span>
    <span>
      {(() => {
        let total = 0;
        if (selectedAddons.rush) total += 10;
        return `$${total.toFixed(2)}`;
      })()}
    </span>
  </div>

  <p className="text-xs text-gray-500 mt-2">
    Final cost depends on laundry weight and selected add-ons
  </p>
</div>


          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/order-type"
              className="bg-white text-gray-700 border-2 border-gray-300 px-6 py-4 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-400 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </a>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg flex items-center justify-center gap-2"
            >
              Continue to Review
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
