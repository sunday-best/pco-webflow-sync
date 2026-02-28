import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ConnectPCODialog({ open, onOpenChange, connectionId, onSuccess }) {
  const [appId, setAppId] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!appId.trim() || !secret.trim()) {
      setError('Both Application ID and Secret are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await base44.functions.invoke('pcoAuth', {
        action: 'connectPersonalToken',
        connectionId,
        appId: appId.trim(),
        secret: secret.trim()
      });
      if (result.data?.error) throw new Error(result.data.error);
      onSuccess(result.data);
      onOpenChange(false);
    } catch (e) {
      setError(e.message || 'Failed to connect. Check your credentials.');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Planning Center</DialogTitle>
          <DialogDescription>
            Enter your PCO Personal Access Token credentials to connect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Go to{' '}
              <a
                href="https://api.planningcenteronline.com/oauth/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium inline-flex items-center gap-1"
              >
                api.planningcenteronline.com/oauth/applications
                <ExternalLink className="w-3 h-3" />
              </a>
              , create a Personal Access Token, and paste the Application ID and Secret below.
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="pco-app-id">Application ID</Label>
            <Input
              id="pco-app-id"
              className="mt-1.5 font-mono"
              placeholder="Your PCO Application ID"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="pco-secret">Secret</Label>
            <Input
              id="pco-secret"
              type="password"
              className="mt-1.5 font-mono"
              placeholder="Your PCO Secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleConnect}
            disabled={loading || !appId || !secret}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}