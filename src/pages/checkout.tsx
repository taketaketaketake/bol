import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { readWizard, clearWizard } from "../utils/wizard.server";
// import { supabaseService } from "~/utils/supabase.server";
// import { stripe } from "~/utils/stripe.server"; // init with secret key

export async function loader({ request }: LoaderFunctionArgs) {
  const w = await readWizard(request);
  if (!w.customer) return json({}, { status: 302, headers: { Location: "/details" }});
  // TODO: create or upsert customer,address; create order draft; create Stripe customer/payment intent; return clientSecret
  const summary = {
    pickup: `${w.address?.line1}, ${w.address?.postal} • ${w.date}`,
    orderType: w.orderType,
    addons: w.addons,
    estimate: w.estimate
  };
  return json({ w, summary, stripeClientSecret: null }); // replace null when wired
}

export async function action({ request }: ActionFunctionArgs) {
  // TODO: confirm Stripe intent on client, then verify here and finalize order -> status scheduled
  // await supabaseService().from("orders").insert({...});
  return clearWizard(request, "/confirm"); // go to a simple Thank You route
}

// Helper function to format order type display
const formatOrderType = (orderType: string) => {
  switch(orderType) {
    case 'wash_fold': return 'Wash & Fold';
    case 'dry_cleaning': return 'Dry Cleaning';
    case 'combo': return 'Combo Service';
    case 'bedding_bundle': return 'Bedding Bundle';
    default: return orderType;
  }
};

export default function Checkout() {
  const { w, summary } = useLoaderData<typeof loader>();
  
  const calculateTotal = () => {
    let total = summary.estimate?.subtotalCents || 3375; // Default $33.75
    return (total / 100).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-blue-600">Schedule</span>
            </div>
            <div className="w-8 h-0.5 bg-blue-600"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-blue-600">Service</span>
            </div>
            <div className="w-8 h-0.5 bg-blue-600"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-blue-600">Add-ons</span>
            </div>
            <div className="w-8 h-0.5 bg-blue-600"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-blue-600">Details</span>
            </div>
            <div className="w-8 h-0.5 bg-blue-600"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                5
              </div>
              <span className="ml-2 text-sm font-medium text-blue-600">Payment</span>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Review & Confirm
          </h1>
          <p className="text-gray-600">
            Review your order details and complete your booking
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Pickup Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Pickup Details</h2>
                <a href="/start-basic" className="ml-auto text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Edit
                </a>
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-900">Address:</span>
                  <p className="text-gray-600 mt-1">{w.address?.line1}</p>
                  <p className="text-gray-600">{w.address?.postal}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-900">Date & Contact:</span>
                  <p className="text-gray-600 mt-1">{w.date}</p>
                  <p className="text-gray-600">{w.phone}</p>
                </div>
              </div>
            </div>

            {/* Service Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Service</h2>
                <a href="/order-type" className="ml-auto text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Edit
                </a>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{formatOrderType(summary.orderType)}</h3>
                  <p className="text-sm text-gray-600">$2.25 per lb • 24-hour turnaround</p>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-500">Starting at</span>
                  <p className="font-semibold text-gray-900">$2.25/lb</p>
                </div>
              </div>
            </div>

            {/* Add-ons */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Add-ons</h2>
                <a href="/addons" className="ml-auto text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Edit
                </a>
              </div>
              
              {(summary.addons?.eco || summary.addons?.hangDry || summary.addons?.rush) ? (
                <div className="space-y-3">
                  {summary.addons?.eco && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.5 2.5L16 4.5 14.5 3 16 1.5 17.5 3 16 4.5 17.5 6M13 13h4-4V8H9v5h4 0z" />
                          </svg>
                        </div>
                        <span className="text-gray-900">Eco-friendly detergent</span>
                      </div>
                      <span className="text-gray-600">+$0.10/lb</span>
                    </div>
                  )}
                  
                  {summary.addons?.hangDry && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        <span className="text-gray-900">Hang-dry delicates</span>
                      </div>
                      <span className="text-gray-600">+$0.25/lb</span>
                    </div>
                  )}
                  
                  {summary.addons?.rush && (
                    <div className="flex justify-between items-center py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <span className="text-gray-900">Same-day rush service</span>
                      </div>
                      <span className="text-gray-600">+$10</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 italic">No add-ons selected</p>
              )}
            </div>

            {/* Customer Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Contact Information</h2>
                <a href="/details" className="ml-auto text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Edit
                </a>
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-900">Name:</span>
                  <p className="text-gray-600 mt-1">{w.customer?.fullName}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-900">Email:</span>
                  <p className="text-gray-600 mt-1">{w.customer?.email}</p>
                </div>
              </div>
            </div>

            {/* Special Instructions */}
            {w.addons?.notes && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Special Instructions</h2>
                </div>
                <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{w.addons.notes}</p>
              </div>
            )}
          </div>

          {/* Payment Sidebar */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
              
              {/* Order Total */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
                
                <div className="space-y-3 pb-4 border-b border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Estimated subtotal (15 lbs)</span>
                    <span className="text-gray-900">${calculateTotal()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pickup & delivery</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-4">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">${calculateTotal()}</span>
                </div>
                
                <p className="text-xs text-gray-500 mt-2">
                  Final amount will be based on actual weight
                </p>
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
                
                {/* Stripe Elements would go here */}
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 font-medium">Secure Card Payment</p>
                  <p className="text-xs text-gray-500 mt-1">Stripe Elements will load here</p>
                </div>
              </div>

              {/* Confirm Button */}
              <Form method="post">
                <button 
                  type="submit"
                  className="w-full bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Confirm & Schedule Pickup
                </button>
              </Form>

              {/* Trust Signals */}
              <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Secure payment processing
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  30-minute pickup window notification
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  100% satisfaction guarantee
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}