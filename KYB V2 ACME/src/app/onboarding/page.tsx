'use client';

import Link from 'next/link';
import { BusinessSearchForm } from '@/components/business/BusinessSearchForm';

export default function SearchPage() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-wise-navy">Business Search</h1>
          <p className="text-sm text-wise-gray-500 mt-1">
            Search for a business to begin the onboarding process. Enter the business name
            and select the country where it is registered.
          </p>
        </div>
        <Link
          href="/onboarding/cleanup"
          className="text-xs text-wise-gray-400 hover:text-red-500 transition-colors mt-1"
          title="Clean up entities"
        >
          Delete
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-wise-gray-200 shadow-sm p-6">
        <BusinessSearchForm />
      </div>
    </div>
  );
}
