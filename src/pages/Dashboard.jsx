import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import ConnectionCard from '@/components/dashboard/ConnectionCard';
import EmptyState from '@/components/dashboard/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState(null);

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => base44.entities.Connection.list('-updated_date'),
  });

  const syncMutation = useMutation({
    mutationFn: async (connectionId) => {
      setSyncingId(connectionId);
      return base44.functions.invoke('runSync', { connectionId, trigger: 'manual' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onSettled: () => {
      setSyncingId(null);
    }
  });

  const handleSyncNow = (connectionId) => {
    syncMutation.mutate(connectionId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Connections</h1>
          <p className="text-sm text-slate-500 mt-1">
            {connections?.length || 0} church{connections?.length !== 1 ? 'es' : ''} connected
          </p>
        </div>
        <Link to={createPageUrl('NewConnection')}>
          <Button className="bg-slate-900 hover:bg-slate-800">
            <Plus className="w-4 h-4 mr-2" />
            New Connection
          </Button>
        </Link>
      </div>

      {/* Connections Grid */}
      {!connections?.length ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map(connection => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onSyncNow={handleSyncNow}
              isSyncing={syncingId === connection.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}