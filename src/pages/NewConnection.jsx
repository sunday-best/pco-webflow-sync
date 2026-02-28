import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowRight, Church, Loader2 } from 'lucide-react';

export default function NewConnection() {
  const navigate = useNavigate();
  const [name, setName] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Connection.create(data);
    },
    onSuccess: (connection) => {
      navigate(createPageUrl(`ConnectionDetail?id=${connection.id}`));
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    createMutation.mutate({
      name: name.trim(),
      status: 'setup_incomplete',
      on_removal_action: 'archive',
      field_mappings: [],
      consecutive_failures: 0
    });
  };

  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
            <Church className="w-6 h-6 text-slate-600" />
          </div>
          <CardTitle>Create New Connection</CardTitle>
          <CardDescription>
            Connect a church's Planning Center Registrations to their Webflow Events collection.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Connection Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., First Baptist Church"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  This is typically the church name for easy identification.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => navigate(createPageUrl('Dashboard'))}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!name.trim() || createMutation.isPending}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Continue Setup
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}