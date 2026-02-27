import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white" id="contact">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">About Us</h3>
            <p className="text-gray-600">
              Blue Ridge Blueberries is a family-owned farm dedicated to growing 
              the finest organic blueberries in the region. Our sustainable farming 
              practices ensure the highest quality berries while protecting our 
              environment.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="space-y-3">
              <p className="flex items-center text-gray-600">
                <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                123 Blueberry Lane, Blue Ridge, GA 30513
              </p>
              <p className="flex items-center text-gray-600">
                <Phone className="h-5 w-5 mr-2 text-blue-600" />
                (555) 123-4567
              </p>
              <p className="flex items-center text-gray-600">
                <Mail className="h-5 w-5 mr-2 text-blue-600" />
                info@blueridgeblueberries.com
              </p>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Farm Hours</h3>
            <div className="space-y-2 text-gray-600">
              <p>Monday - Saturday: 8:00 AM - 6:00 PM</p>
              <p>Sunday: 9:00 AM - 4:00 PM</p>
              <p className="mt-4 font-medium">U-Pick Season: June - August</p>
            </div>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-center text-gray-500">
            © {new Date().getFullYear()} Blue Ridge Blueberries. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}