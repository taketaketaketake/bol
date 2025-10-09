export default function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: '#111827' }} className="text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">

          {/* Company Info */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/images/t shirt.PNG" alt="Bags of Laundry" className="h-8 w-auto" />
              <img src="/images/bags of laundry logo - Copy.png" alt="Bags of Laundry Logo" className="h-8 w-auto brightness-0 invert" />
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Professional laundry pickup & delivery service in Detroit and Metro suburbs.
            </p>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <span>📞</span>
                <a href="tel:+18559274224" className="text-gray-400 hover:text-white">855&nbsp;WASH-BAGS</a>
              </p>
              <p className="flex items-center gap-2">
                <span>✉️</span>
                <a href="mailto:bagsoflaundry@gmail.com" className="text-gray-400 hover:text-white">bagsoflaundry@gmail.com</a>
              </p>
            </div>
          </div>



          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="/" className="text-gray-400 hover:text-white">Home</a></li>
              <li><a href="/services" className="text-gray-400 hover:text-white">Services</a></li>
              <li><a href="/pricing" className="text-gray-400 hover:text-white">Pricing</a></li>
              <li><a href="/service-areas" className="text-gray-400 hover:text-white">Service Areas</a></li>
              <li><a href="/how-it-works" className="text-gray-400 hover:text-white">How It Works</a></li>
              <li><a href="/start-basic" className="text-gray-400 hover:text-white">Start Order</a></li>
              <li><a href="/laundromat-partners" className="text-gray-400 hover:text-white">Partner With Us</a></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-bold text-lg mb-4">Our Services</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="/services#washfold" className="text-gray-400 hover:text-white">Wash & Fold</a></li>
              <li><a href="/services#drycleaning" className="text-gray-400 hover:text-white">Dry Cleaning</a></li>
              <li><a href="/services#commercial" className="text-gray-400 hover:text-white">Commercial Laundry</a></li>
              <li className="text-gray-400">Same-Day Service</li>
              <li className="text-gray-400">Eco-Friendly Options</li>
            </ul>
          </div>

          {/* Service Areas */}
          <div>
            <h3 className="font-bold text-lg mb-4">Service Areas</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Detroit</li>
              <li>Royal Oak</li>
              <li>Dearborn</li>
              <li>Ferndale</li>
              <li>Grosse Pointe</li>
              <li>Warren</li>
              <li>Southfield</li>
              <li><a href="/service-areas" className="text-white hover:underline">View All Areas →</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-400">
              © {currentYear} Bags of Laundry. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <a href="/terms" className="text-gray-400 hover:text-white">Terms of Service</a>
              <a href="/privacy" className="text-gray-400 hover:text-white">Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
