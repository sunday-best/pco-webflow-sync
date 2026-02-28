import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, 
  Loader2, 
  Check, 
  Link as LinkIcon,
  AlertCircle,
  ChevronLeft,
  Trash2,
  Settings,
  History,
  GitBranch,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FieldMappingEditor from '@/components/connection/FieldMappingEditor';
import SyncHistoryTable from '@/components/connection/SyncHistoryTable';
import ConnectPCODialog from '@/components/connection/ConnectPCODialog';
import ConnectWebflowDialog from '@/components/connection/ConnectWebflowDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ConnectionDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const connectionId = urlParams.get('id');

  const [activeTab, setActiveTab] = useState('settings');
  const [webflowSites, setWebflowSites] = useState([]);
  const [webflowCollections, setWebflowCollections] = useState([]);
  const [webflowFields, setWebflowFields] = useState([]);
  const [loadingWebflow, setLoadingWebflow] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  // Fetch connection
  const { data: connection, isLoading: loadingConnection } = useQuery({
    queryKey: ['connection', connectionId],
    queryFn: () => base44.entities.Connection.filter({ id: connectionId }),
    select: (data) => data?.[0],
    enabled: !!connectionId
  });

  // Fetch sync runs
  const { data: syncRuns, isLoading: loadingRuns } = useQuery({
    queryKey: ['syncRuns', connectionId],
    queryFn: () => base44.entities.SyncRun.filter({ connection_id: connectionId }, '-created_date', 20),
    enabled: !!connectionId
  });

  // Load Webflow data when token exists
  useEffect(() => {
    if (connection?.webflow_access_token) {
      loadWebflowSites();
    }
  }, [connection?.webflow_access_token]);

  useEffect(() => {
    if (connection?.webflow_site_id && connection?.webflow_access_token) {
      loadWebflowCollections(connection.webflow_site_id);
    }
  }, [connection?.webflow_site_id, connection?.webflow_access_token]);

  useEffect(() => {
    if (connection?.webflow_collection_id && connection?.webflow_access_token) {
      loadWebflowFields(connection.webflow_collection_id);
    }
  }, [connection?.webflow_collection_id, connection?.webflow_access_token]);

  const loadWebflowSites = async () => {
    if (!connection?.webflow_access_token) return;
    setLoadingWebflow(true);
    try {
      const result = await base44.functions.invoke('webflowApi', {
        action: 'listSites',
        connectionId
      });
      setWebflowSites(result.data?.sites || []);
    } catch (e) {
      console.error('Failed to load Webflow sites:', e);
    }
    setLoadingWebflow(false);
  };

  const loadWebflowCollections = async (siteId) => {
    if (!connection?.webflow_access_token) return;
    try {
      const result = await base44.functions.invoke('webflowApi', {
        action: 'listCollections',
        connectionId,
        siteId
      });
      setWebflowCollections(result.data?.collections || []);
    } catch (e) {
      console.error('Failed to load collections:', e);
    }
  };

  const loadWebflowFields = async (collectionId) => {
    if (!connection?.webflow_access_token) return;
    try {
      const result = await base44.functions.invoke('webflowApi', {
        action: 'getCollectionFields',
        connectionId,
        collectionId
      });
      setWebflowFields(result.data?.fields || []);
    } catch (e) {
      console.error('Failed to load fields:', e);
    }
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Connection.update(connectionId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection', connectionId] });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return base44.entities.Connection.delete(connectionId);
    },
    onSuccess: () => {
      navigate(createPageUrl('Dashboard'));
    }
  });

  // Sync now mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      setSyncingNow(true);
      return base44.functions.invoke('runSync', { connectionId, trigger: 'manual' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['syncRuns', connectionId] });
    },
    onSettled: () => {
      setSyncingNow(false);
    }
  });

  const handleConnectPCO = async () => {
    // In a real implementation, this would trigger OAuth flow
    // For now, we'll use a placeholder
    const result = await base44.functions.invoke('pcoAuth', { action: 'getAuthUrl', connectionId });
    if (result.data?.url) {
      window.location.href = result.data.url;
    }
  };

  const handleConnectWebflow = async () => {
    const result = await base44.functions.invoke('webflowAuth', { action: 'getAuthUrl', connectionId });
    if (result.data?.url) {
      window.location.href = result.data.url;
    }
  };

  const handleSiteChange = async (siteId) => {
    const site = webflowSites.find(s => s.id === siteId);
    await updateMutation.mutateAsync({
      webflow_site_id: siteId,
      webflow_site_name: site?.displayName || site?.name,
      webflow_collection_id: null,
      webflow_collection_name: null,
      field_mappings: []
    });
    setWebflowCollections([]);
    setWebflowFields([]);
    loadWebflowCollections(siteId);
  };

  const handleCollectionChange = async (collectionId) => {
    const collection = webflowCollections.find(c => c.id === collectionId);
    await updateMutation.mutateAsync({
      webflow_collection_id: collectionId,
      webflow_collection_name: collection?.displayName || collection?.name,
      field_mappings: []
    });
    loadWebflowFields(collectionId);
  };

  const handleMappingsChange = (mappings) => {
    updateMutation.mutate({ field_mappings: mappings });
  };

  const handleRemovalActionChange = (action) => {
    updateMutation.mutate({ on_removal_action: action });
  };

  const canSync = connection?.pco_access_token && 
                  connection?.webflow_access_token && 
                  connection?.webflow_collection_id &&
                  connection?.field_mappings?.some(m => m.pco_field === 'event.id');

  const updateStatus = () => {
    if (canSync && connection.status === 'setup_incomplete') {
      updateMutation.mutate({ status: 'active' });
    }
  };

  useEffect(() => {
    if (canSync && connection?.status === 'setup_incomplete') {
      updateMutation.mutate({ status: 'active' });
    }
  }, [canSync, connection?.status]);

  if (loadingConnection) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Connection not found</p>
        <Link to={createPageUrl('Dashboard')}>
          <Button variant="link" className="mt-2">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Dashboard')}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{connection.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={
                connection.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                connection.status === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-slate-50 text-slate-600 border-slate-200'
              }>
                {connection.status?.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={!canSync || syncingNow}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncingNow ? 'animate-spin' : ''}`} />
            {syncingNow ? 'Syncing...' : 'Sync Now'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Connection?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this connection and all sync history. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="mapping" className="gap-2">
            <GitBranch className="w-4 h-4" />
            Field Mapping
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            Sync History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6 mt-6">
          {/* PCO Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Planning Center Registrations</CardTitle>
              <CardDescription>Connect to the church's PCO account to fetch events.</CardDescription>
            </CardHeader>
            <CardContent>
              {connection.pco_access_token ? (
                <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Check className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-emerald-900">Connected</p>
                      <p className="text-sm text-emerald-700">{connection.pco_organization_name || 'Organization connected'}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleConnectPCO}>
                    Reconnect
                  </Button>
                </div>
              ) : (
                <Button onClick={handleConnectPCO} className="w-full bg-slate-900 hover:bg-slate-800">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Connect Planning Center
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Webflow Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Webflow</CardTitle>
              <CardDescription>Connect to Webflow and select the events collection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connection.webflow_access_token ? (
                <>
                  <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Check className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-emerald-900">Connected to Webflow</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleConnectWebflow}>
                      Reconnect
                    </Button>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Webflow Site</Label>
                      <Select 
                        value={connection.webflow_site_id || ''} 
                        onValueChange={handleSiteChange}
                        disabled={loadingWebflow}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder={loadingWebflow ? 'Loading...' : 'Select a site'} />
                        </SelectTrigger>
                        <SelectContent>
                          {webflowSites.map(site => (
                            <SelectItem key={site.id} value={site.id}>
                              {site.displayName || site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Events Collection</Label>
                      <Select 
                        value={connection.webflow_collection_id || ''} 
                        onValueChange={handleCollectionChange}
                        disabled={!connection.webflow_site_id}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select a collection" />
                        </SelectTrigger>
                        <SelectContent>
                          {webflowCollections.map(coll => (
                            <SelectItem key={coll.id} value={coll.id}>
                              {coll.displayName || coll.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              ) : (
                <Button onClick={handleConnectWebflow} className="w-full bg-slate-900 hover:bg-slate-800">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Connect Webflow
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Sync Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sync Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>On PCO Event Removal</Label>
                <p className="text-sm text-slate-500 mb-2">
                  What happens when an event is archived or deleted in PCO?
                </p>
                <Select 
                  value={connection.on_removal_action || 'archive'} 
                  onValueChange={handleRemovalActionChange}
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="archive">Archive in Webflow (default)</SelectItem>
                    <SelectItem value="delete">Delete from Webflow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Syncs run automatically every hour. Only public, upcoming events are synced.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="mt-6">
          {!connection.webflow_collection_id ? (
            <Card className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">Please select a Webflow collection first</p>
              <Button variant="link" onClick={() => setActiveTab('settings')} className="mt-2">
                Go to Settings
              </Button>
            </Card>
          ) : (
            <FieldMappingEditor
              mappings={connection.field_mappings || []}
              webflowFields={webflowFields}
              onChange={handleMappingsChange}
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <SyncHistoryTable 
            runs={syncRuns} 
            isLoading={loadingRuns}
            connectionId={connectionId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}