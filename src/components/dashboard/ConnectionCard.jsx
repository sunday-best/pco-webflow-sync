import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  Archive,
  Trash2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const statusConfig = {
  active: { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  paused: { label: 'Paused', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  error: { label: 'Error', color: 'bg-red-50 text-red-700 border-red-200' },
  setup_incomplete: { label: 'Setup Incomplete', color: 'bg-slate-50 text-slate-600 border-slate-200' }
};

const syncStatusConfig = {
  success: { icon: CheckCircle2, color: 'text-emerald-500' },
  partial: { icon: AlertTriangle, color: 'text-amber-500' },
  failed: { icon: XCircle, color: 'text-red-500' },
  never: { icon: Clock, color: 'text-slate-400' }
};

export default function ConnectionCard({ connection, onSyncNow, isSyncing }) {
  const status = statusConfig[connection.status] || statusConfig.setup_incomplete;
  const syncStatus = syncStatusConfig[connection.last_sync_status] || syncStatusConfig.never;
  const SyncIcon = syncStatus.icon;
  const stats = connection.last_sync_stats || {};

  return (
    <Card className="p-5 hover:shadow-md transition-shadow bg-white">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 truncate">{connection.name}</h3>
            <Badge variant="outline" className={status.color}>
              {status.label}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 truncate">
            {connection.pco_organization_name || 'PCO not connected'} → {connection.webflow_site_name || 'Webflow not connected'}
          </p>
        </div>
      </div>

      {/* Last Sync Status */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
        <SyncIcon className={`w-5 h-5 ${syncStatus.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700">
            {connection.last_sync_status === 'never' 
              ? 'Never synced' 
              : `Last sync: ${connection.last_sync_status}`}
          </p>
          {connection.last_sync_at && (
            <p className="text-xs text-slate-500">
              {formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>

      {/* Error summary */}
      {connection.last_sync_status === 'failed' && connection.error_summary && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700 font-medium">Error: {connection.error_summary}</p>
        </div>
      )}

      {/* Stats */}
      {connection.last_sync_stats && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 bg-emerald-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-emerald-600 mb-0.5">
              <ArrowUpCircle className="w-3 h-3" />
              <span className="text-sm font-semibold">{stats.created || 0}</span>
            </div>
            <p className="text-[10px] text-emerald-600">Created</p>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-blue-600 mb-0.5">
              <RefreshCw className="w-3 h-3" />
              <span className="text-sm font-semibold">{stats.updated || 0}</span>
            </div>
            <p className="text-[10px] text-blue-600">Updated</p>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-amber-600 mb-0.5">
              <Archive className="w-3 h-3" />
              <span className="text-sm font-semibold">{stats.archived || 0}</span>
            </div>
            <p className="text-[10px] text-amber-600">Archived</p>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-red-600 mb-0.5">
              <Trash2 className="w-3 h-3" />
              <span className="text-sm font-semibold">{stats.deleted || 0}</span>
            </div>
            <p className="text-[10px] text-red-600">Deleted</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSyncNow(connection.id)}
          disabled={isSyncing || connection.status === 'setup_incomplete'}
          className="flex-1"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
        <Link to={createPageUrl(`ConnectionDetail?id=${connection.id}`)}>
          <Button size="sm" variant="ghost">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}