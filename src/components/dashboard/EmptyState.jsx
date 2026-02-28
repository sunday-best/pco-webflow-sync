import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
        <RefreshCw className="w-10 h-10 text-slate-400" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">No connections yet</h2>
      <p className="text-slate-500 text-center max-w-md mb-6">
        Create your first connection to start syncing events from Planning Center Registrations to Webflow.
      </p>
      <Link to={createPageUrl('NewConnection')}>
        <Button className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />
          Create First Connection
        </Button>
      </Link>
    </div>
  );
}