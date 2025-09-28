import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { readWizard, writeWizard } from "../utils/wizard.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const w = await readWizard(request);
  if (!w.address || !w.date || !w.phone) {
    return json({}, { status: 302, headers: { Location: "/start-basic" }});
  }
  return json({ w });
}

export async function action({ request }: ActionFunctionArgs) {
  const fd = await request.formData();
  const orderType = String(fd.get("orderType") || "");
  const addons: { [id: string]: number } = {};

  fd.forEach((value, key) => {
    if (key.startsWith("addon_")) {
      const id = key.replace("addon_", "");
      addons[id] = parseInt(String(value), 10);
    }
  });

  return writeWizard(request, { orderType, addons }, "/addons");
}

export default function OrderType() {
  const { w } = useLoaderData<typeof loader>();

  const [selectedMain, setSelectedMain] = useState<string>(w.orderType || "");
  const [addons, setAddons] = useState<{ [id: string]: number }>(w.addons || {});
  const [isMember, setIsMember] = useState(false);

  const memberRate = 1.99;
  const nonMemberRate = 2.49;
  const currentRate = isMember ? memberRate : nonMemberRate;

  const perPoundOption = {
    id: "per_pound",
    name: "Per Pound",
    description: "Professional wash, dry & fold. Pay only for actual weight.",
    image: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?q=80&w=400&auto=format&fit=crop",
    details: `$${currentRate.toFixed(2)}/lb · $35 minimum`,
    turnaround: "~24 hours"
  };

  const bagOptions = [
    { id: "small_bag", name: "Small Bag", subtitle: "Fits 12–18 lb", description: "Great for individuals or small loads.", price: "$35", turnaround: "~24 hours", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=400&auto=format&fit=crop" },
    { id: "medium_bag", name: "Medium Bag", subtitle: "Fits 20–30 lb", description: "Most popular · perfect for weekly family laundry.", price: "$55", turnaround: "~24 hours", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=400&auto=format&fit=crop" },
    { id: "large_bag", name: "Large Bag", subtitle: "Fits 35–45 lb", description: "Best value for bulk laundry or large households.", price: "$85", turnaround: "~24 hours", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=400&auto=format&fit=crop" }
  ];

  const specialtyOptions = [
    { id: "comforter", name: "Comforter", price: 20, unit: "each", image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=400&auto=format&fit=crop" },
    { id: "bedding_bundle", name: "Bedding Bundle", price: 25, unit: "set", image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=400&auto=format&fit=crop" },
    { id: "dry_cleaning", name: "Dry Cleaning", price: 8, unit: "per item", image: "https://images.unsplash.com/photo-1516826957135-700dedea698c?q=80&w=400&auto=format&fit=crop" }
  ];

  const updateAddonQty = (id: string, delta: number) => {
    setAddons((prev) => {
      const newQty = (prev[id] || 0) + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: newQty };
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header + Member Toggle */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Choose Your Service</h1>
          <p className="text-gray-600 mb-6">Select a main service and add any specialty items.</p>

          <div className="inline-flex items-center bg-white rounded-xl p-1 shadow-sm border-2 border-gray-200 mb-4">
            <button
              type="button"
              onClick={() => setIsMember(false)}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                !isMember ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Non-Member
            </button>
            <button
              type="button"
              onClick={() => setIsMember(true)}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                isMember ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Member
            </button>
          </div>

          <p className="text-sm text-center mb-6">
            {!isMember ? (
              <>Non-Member Pricing: <span className="font-semibold">${nonMemberRate.toFixed(2)}/lb</span>. Save with membership – $99/year unlocks <span className="font-semibold">${memberRate.toFixed(2)}/lb</span>.</>
            ) : (
              <span className="text-green-600 font-medium">🎉 Member Pricing Active: ${memberRate.toFixed(2)}/lb (requires $99/year membership)</span>
            )}
          </p>
        </div>

        <Form method="post" className="space-y-12">
          <input type="hidden" name="orderType" value={selectedMain} />
          {Object.entries(addons).map(([id, qty]) => (
            <input key={id} type="hidden" name={`addon_${id}`} value={qty} />
          ))}

          {/* Per Pound */}
          <div>
            <h2 className="text-xl font-bold mb-4">Per Pound</h2>
            <label className="cursor-pointer group block">
              <input
                type="radio"
                name="orderType"
                value={perPoundOption.id}
                checked={selectedMain === perPoundOption.id}
                onChange={() => setSelectedMain(perPoundOption.id)}
                className="sr-only"
              />
              <div className={`relative bg-white rounded-xl border-2 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group-hover:border-blue-400 ${
                selectedMain === perPoundOption.id ? "border-blue-500 shadow-lg ring-4 ring-blue-100" : "border-gray-200 shadow-sm"
              }`}>
                <div className="flex gap-6">
                  <img src={perPoundOption.image} alt={perPoundOption.name} className="w-24 h-24 rounded-xl object-cover" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-bold text-xl">{perPoundOption.name}</h3>
                      <span className="font-bold">{perPoundOption.details}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{perPoundOption.description}</p>
                    <span className="mt-2 inline-block text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-md">{perPoundOption.turnaround}</span>
                  </div>
                </div>
              </div>
            </label>
          </div>

          {/* Per Bag */}
          <div>
            <h2 className="text-xl font-bold mb-4">Per Bag</h2>
            <div className="space-y-4">
              {bagOptions.map((opt) => (
                <label key={opt.id} className="cursor-pointer group block">
                  <input
                    type="radio"
                    name="orderType"
                    value={opt.id}
                    checked={selectedMain === opt.id}
                    onChange={() => setSelectedMain(opt.id)}
                    className="sr-only"
                  />
                  <div className={`relative bg-green-50 rounded-xl border-2 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group-hover:border-green-400 ${
                    selectedMain === opt.id ? "border-green-500 shadow-lg ring-4 ring-green-100" : "border-green-200 shadow-sm"
                  }`}>
                    <div className="flex gap-6">
                      <img src={opt.image} alt={opt.name} className="w-24 h-24 rounded-xl object-cover" />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <h3 className="font-bold text-xl">{opt.name}</h3>
                          <span className="font-bold">{opt.price}</span>
                        </div>
                        <p className="text-sm text-gray-500">{opt.subtitle}</p>
                        <p className="text-sm text-gray-600 mt-2">{opt.description}</p>
                        <span className="mt-2 inline-block text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-md">{opt.turnaround}</span>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Specialty */}
          <div>
            <h2 className="text-xl font-bold mb-4">Specialty Items</h2>
            <div className="space-y-4">
              {specialtyOptions.map((opt) => (
                <div key={opt.id} className="bg-purple-50 rounded-xl border-2 p-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold">{opt.name}</h3>
                      <p className="text-sm text-gray-500">${opt.price} {opt.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {addons[opt.id] ? (
                        <>
                          <button type="button" onClick={() => updateAddonQty(opt.id, -1)} className="px-2 py-1 border rounded">-</button>
                          <span>{addons[opt.id]}</span>
                          <button type="button" onClick={() => updateAddonQty(opt.id, 1)} className="px-2 py-1 border rounded">+</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => updateAddonQty(opt.id, 1)} className="px-3 py-1 bg-blue-600 text-white rounded">Add</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700">Continue</button>
          </div>
        {/* Estimate Preview */}
<div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-8">
  <div className="flex items-center gap-3 mb-4">
    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
      <svg
        className="w-5 h-5 text-blue-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
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

  <div className="space-y-2 text-sm">
    {/* Main Service */}
    {selectedMain && (
      <div className="flex justify-between">
        <span>
          {selectedMain === "per_pound"
            ? "Per Pound (est. 20 lb)"
            : bagOptions.find((b) => b.id === selectedMain)?.name}
        </span>
        <span>
          {selectedMain === "per_pound"
            ? `$${(20 * currentRate).toFixed(2)}`
            : bagOptions.find((b) => b.id === selectedMain)?.price}
        </span>
      </div>
    )}

    {/* Add-ons */}
    {Object.entries(addons).map(([id, qty]) => {
      const opt = specialtyOptions.find((o) => o.id === id);
      if (!opt) return null;
      return (
        <div key={id} className="flex justify-between">
          <span>{opt.name} × {qty}</span>
          <span>${(opt.price * qty).toFixed(2)}</span>
        </div>
      );
    })}

    {/* Total */}
    <div className="flex justify-between font-semibold border-t border-blue-200 pt-2 mt-2">
      <span>Total</span>
      <span>
        {(() => {
          let total = 0;
          if (selectedMain === "per_pound") {
            total += 20 * currentRate; // assume 20 lb for estimate
          } else if (selectedMain) {
            const bag = bagOptions.find((b) => b.id === selectedMain);
            if (bag) total += parseFloat(bag.price.replace("$", ""));
          }
          Object.entries(addons).forEach(([id, qty]) => {
            const opt = specialtyOptions.find((o) => o.id === id);
            if (opt) total += opt.price * qty;
          });
          return `$${total.toFixed(2)}`;
        })()}
      </span>
    </div>
  </div>

  <p className="text-xs text-gray-500 mt-3">
    Final pricing confirmed at pickup · $35 minimum applies
  </p>
</div>
</Form>
      </div>
    </div>
  );
}
