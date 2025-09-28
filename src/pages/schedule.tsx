import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { readWizard, writeWizard } from "../utils/wizard.server";

const Schema = z.object({
  line1: z.string().min(3),
  postal: z.string().min(5),
  date: z.string().min(10), // YYYY-MM-DD
  phone: z.string().min(7)
});

export async function loader({ request }: LoaderFunctionArgs) {
  const w = await readWizard(request);
  return json({ w });
}

export async function action({ request }: ActionFunctionArgs) {
  const fd = await request.formData();
  
  const data = {
    line1: String(fd.get("line1") || ""),
    postal: String(fd.get("postal") || ""),
    date: String(fd.get("date") || ""),
    phone: String(fd.get("phone") || "")
  };
  
  const parsed = Schema.safeParse(data);
  if (!parsed.success) return json({ error: "Please complete all fields." }, { status: 400 });

  return writeWizard(request, {
    address: { line1: parsed.data.line1, postal: parsed.data.postal },
    date: parsed.data.date,
    phone: parsed.data.phone
  }, "/order-type");
}

export default function Schedule() {
  const { w } = useLoaderData<typeof loader>();
  const action = useActionData<typeof action>();
  
  // Get tomorrow's date as minimum
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        
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
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Schedule Your Pickup
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Let's get your laundry scheduled! Tell us where and when to pick up your items.
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

        <Form method="post" className="space-y-8">
          
          {/* Pickup Location Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Pickup Location</h2>
                <p className="text-gray-600">Where should we collect your laundry?</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Street Address
                </label>
                <input 
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500 text-lg"
                  name="line1" 
                  placeholder="123 Main Street" 
                  defaultValue={w.address?.line1} 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  ZIP Code
                </label>
                <input 
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500 text-lg"
                  name="postal" 
                  placeholder="12345" 
                  defaultValue={w.address?.postal} 
                  required 
                />
              </div>
            </div>
          </div>

          {/* Pickup Time Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Pickup Date</h2>
                <p className="text-gray-600">When would you like us to pick up?</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Preferred Date
              </label>
              <input 
                className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 text-lg"
                type="date" 
                name="date" 
                min={minDate}
                defaultValue={w.date} 
                required 
              />
              <p className="text-sm text-gray-500 mt-2">
                We typically pick up between 9 AM - 6 PM on your selected date
              </p>
            </div>
          </div>

          {/* Contact Information Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Contact Information</h2>
                <p className="text-gray-600">How can we reach you about your pickup?</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Phone Number
              </label>
              <input 
                className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500 text-lg"
                name="phone" 
                type="tel"
                placeholder="(555) 123-4567" 
                defaultValue={w.phone} 
                required 
              />
              <p className="text-sm text-gray-500 mt-2">
                We'll text you 30 minutes before pickup with driver details
              </p>
            </div>
          </div>

          {/* Service Promise */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">What happens next?</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Choose your service type and any add-ons
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Provide your contact details and payment information
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Get a text 30 minutes before pickup with driver details
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Your clean laundry delivered back in 24 hours
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              type="submit"
              className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-lg"
            >
              Continue to Service Selection
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="text-center">
            <a 
              href="/" 
              className="text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              ← Back to Home
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
}