import React from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ChevronLeft, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock,
  ArrowUpCircle,
  RefreshCw,
  Archive,
  Trash2,
  SkipForward,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

const statusConfig = {
  running: { icon: Loader2, color: 'bg-blue-50 text-blue-700', label: 'Running', spin: true },
  success: { icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700', label: 'Success' },
  partial: { icon: AlertTriangle, color: 'bg-amber-50 text-amber-700', label: 'Partial Success' },
  failed: { icon: XCircle, color: 'bg-red-50 text-red-700', label: 'Failed' }
};

const actionIcons = {
  create: ArrowUpCircle,
  update: RefreshCw,
  archive: Archive,
  delete: Trash2,
  skip: SkipForward
};

const actionColors = {
  create: 'text-emerald-600',
  update: 'text-blue-600',
  archive: 'text-amber-600',
  delete: 'text-red-600',
  skip: 'text-slate-400'
};

export default function SyncRunDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const runId = urlParams.get('id');

  const { data: run, isLoading } = useQuery({
    queryKey: ['syncRun', runId],
    queryFn: () => base44.entities.SyncRun.filter({ id: runId }),
    select: (data) => data?.[0],
    enabled: !!runId
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Sync run not found</p>
        <Link to={createPageUrl('Dashboard')}>
          <Button variant="link" className="mt-2">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const status = statusConfig[run.status] || statusConfig.failed;
  const StatusIcon = status.icon;
  const stats = run.stats || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl(`ConnectionDetail?id=${run.connection_id}`)}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sync Run Details</h1>
          <p className="text-sm text-slate-500">{run.connection_name}</p>
        </div>
      </div>

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Overview</CardTitle>
            <Badge className={`${status.color} gap-1`}>
              <StatusIcon className={`w-3 h-3 ${status.spin ? 'animate-spin' : ''}`} />
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-slate-500">Started</p>
              <p className="font-medium">
                {run.started_at 
                  ? format(new Date(run.started_at), 'MMM d, yyyy h:mm a')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Duration</p>
              <p className="font-medium">
                {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(2)}s` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Trigger</p>
              <Badge variant="outline">{run.trigger || 'scheduled'}</Badge>
            </div>
            <div>
              <p className="text-sm text-slate-500">Events Fetched</p>
              <p className="font-medium">{stats.pco_events_fetched || 0}</p>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Stats Grid */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <ArrowUpCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-emerald-700">{stats.created || 0}</p>
              <p className="text-xs text-emerald-600">Created</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <RefreshCw className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-700">{stats.updated || 0}</p>
              <p className="text-xs text-blue-600">Updated</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <Archive className="w-5 h-5 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-700">{stats.archived || 0}</p>
              <p className="text-xs text-amber-600">Archived</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-700">{stats.deleted || 0}</p>
              <p className="text-xs text-red-600">Deleted</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <SkipForward className="w-5 h-5 text-slate-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-slate-700">{stats.skipped || 0}</p>
              <p className="text-xs text-slate-500">Skipped</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-700">{stats.errors || 0}</p>
              <p className="text-xs text-red-600">Errors</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Summary */}
      {run.error_summary && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-lg text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Error Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-800">{run.error_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Error Details */}
      {run.error_details?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Error Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {run.error_details.map((error, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-red-900">{error.event_name || error.event_id}</p>
                      <p className="text-sm text-red-700">Action: {error.action}</p>
                    </div>
                    {error.retry_count > 0 && (
                      <Badge variant="outline" className="text-red-700">
                        {error.retry_count} retries
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-red-800 font-mono bg-red-100 p-2 rounded">
                    {error.error_message}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Log */}
      {run.event_log?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event Log</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Webflow Item</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.event_log.map((log, index) => {
                  const ActionIcon = actionIcons[log.action] || Clock;
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{log.event_name}</p>
                          <p className="text-xs text-slate-500">{log.pco_event_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 ${actionColors[log.action]}`}>
                          <ActionIcon className="w-4 h-4" />
                          <span className="capitalize">{log.action}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-slate-500">
                          {log.webflow_item_id || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}