import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const statusConfig = {
  running: { icon: Loader2, color: 'bg-blue-50 text-blue-700', label: 'Running', spin: true },
  success: { icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700', label: 'Success' },
  partial: { icon: AlertTriangle, color: 'bg-amber-50 text-amber-700', label: 'Partial' },
  failed: { icon: XCircle, color: 'bg-red-50 text-red-700', label: 'Failed' }
};

export default function SyncHistoryTable({ runs, isLoading, connectionId }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading history...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sync History</CardTitle>
      </CardHeader>
      <CardContent>
        {!runs?.length ? (
          <div className="text-center py-8 text-slate-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No sync runs yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead className="text-center">Created</TableHead>
                  <TableHead className="text-center">Updated</TableHead>
                  <TableHead className="text-center">Archived</TableHead>
                  <TableHead className="text-center">Errors</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const status = statusConfig[run.status] || statusConfig.failed;
                  const StatusIcon = status.icon;
                  const stats = run.stats || {};

                  return (
                    <TableRow key={run.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="secondary" className={`${status.color} gap-1`}>
                            <StatusIcon className={`w-3 h-3 ${status.spin ? 'animate-spin' : ''}`} />
                            {status.label}
                          </Badge>
                          {run.error_summary && (
                            <p className="text-xs text-red-600 max-w-[200px] truncate" title={run.error_summary}>
                              {run.error_summary}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(run.started_at || run.created_date), 'MMM d, h:mm a')}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(run.started_at || run.created_date), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {run.duration_ms 
                          ? `${(run.duration_ms / 1000).toFixed(1)}s`
                          : run.status === 'running' ? '...' : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {run.trigger || 'scheduled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-emerald-600 font-medium">{stats.created || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-blue-600 font-medium">{stats.updated || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-amber-600 font-medium">{stats.archived || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {stats.errors > 0 ? (
                          <span className="text-red-600 font-medium">{stats.errors}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link to={createPageUrl(`SyncRunDetail?id=${run.id}`)}>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}