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

export default function ConnectWebflowDialog({ open, onOpenChange, connectionId, onSuccess }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!token.trim()) {
      setError('API token is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await base44.functions.invoke('webflowAuth', {
        action: 'connectApiToken',
        connectionId,
        token: token.trim()
      });
      if (result.data?.error) throw new Error(result.data.error);
      onSuccess(result.data);
      onOpenChange(false);
    } catch (e) {
      setError(e.message || 'Failed to connect. Check your API token.');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Webflow</DialogTitle>
          <DialogDescription>
            Enter your Webflow API token to connect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Go to{' '}
              <a
                href="https://webflow.com/dashboard/account/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium inline-flex items-center gap-1"
              >
                Webflow Account → API Access
                <ExternalLink className="w-3 h-3" />
              </a>{' '}
              and generate a Site API Token for the relevant site (needs CMS read/write access).
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="wf-token">Webflow API Token</Label>
            <Input
              id="wf-token"
              type="password"
              className="mt-1.5 font-mono"
              placeholder="Your Webflow API token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
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
            disabled={loading || !token}
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