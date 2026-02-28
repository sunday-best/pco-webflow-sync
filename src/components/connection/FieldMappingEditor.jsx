import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  ArrowRight, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Settings2
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// PCO Registrations fields organized by category
const PCO_FIELDS = {
  'Identity': [
    { id: 'event.id', label: 'Event ID', type: 'text', required: true },
    { id: 'event.updated_at', label: 'Updated At', type: 'datetime' }
  ],
  'Core Info': [
    { id: 'event.name', label: 'Event Name/Title', type: 'text' },
    { id: 'event.summary', label: 'Summary', type: 'text' },
    { id: 'event.description', label: 'Description (HTML)', type: 'richtext' },
    { id: 'event.description_plain', label: 'Description (Plain Text)', type: 'text', virtual: true }
  ],
  'Dates & Times': [
    { id: 'event.starts_at', label: 'Start Date/Time', type: 'datetime' },
    { id: 'event.ends_at', label: 'End Date/Time', type: 'datetime' },
    { id: 'event.all_day', label: 'All Day Event', type: 'boolean' }
  ],
  'Status': [
    { id: 'event.public', label: 'Is Public', type: 'boolean' },
    { id: 'event.archived', label: 'Is Archived', type: 'boolean' },
    { id: 'event.registration_open', label: 'Registration Open', type: 'boolean' }
  ],
  'Links': [
    { id: 'event.registration_url', label: 'Registration URL', type: 'url' },
    { id: 'event.event_url', label: 'Event URL', type: 'url' }
  ],
  'Location': [
    { id: 'event.location_name', label: 'Location Name', type: 'text' },
    { id: 'event.location_full', label: 'Full Address', type: 'text', virtual: true },
    { id: 'event.location_address_line_1', label: 'Address Line 1', type: 'text' },
    { id: 'event.location_address_line_2', label: 'Address Line 2', type: 'text' },
    { id: 'event.location_city', label: 'City', type: 'text' },
    { id: 'event.location_state', label: 'State', type: 'text' },
    { id: 'event.location_postal_code', label: 'Postal Code', type: 'text' },
    { id: 'event.location_country', label: 'Country', type: 'text' }
  ],
  'Media': [
    { id: 'event.image_url', label: 'Image URL', type: 'url' },
    { id: 'event.thumbnail_url', label: 'Thumbnail URL', type: 'url' }
  ],
  'Capacity': [
    { id: 'event.capacity', label: 'Capacity', type: 'number' },
    { id: 'event.spots_remaining', label: 'Spots Remaining', type: 'number' },
    { id: 'event.registrations_count', label: 'Registrations Count', type: 'number' }
  ],
  'Categories': [
    { id: 'event.category', label: 'Category', type: 'text' },
    { id: 'event.tags', label: 'Tags', type: 'text' }
  ]
};

const TRANSFORMS = [
  { id: 'none', label: 'None' },
  { id: 'static', label: 'Static Value', hasConfig: true },
  { id: 'fallback', label: 'Fallback if Empty', hasConfig: true },
  { id: 'trim', label: 'Trim Whitespace' },
  { id: 'strip_html', label: 'Strip HTML' },
  { id: 'date_format', label: 'Format Date', hasConfig: true },
  { id: 'combine', label: 'Combine Fields', hasConfig: true }
];

const TYPE_COMPATIBILITY = {
  'text': ['PlainText', 'RichText', 'Link'],
  'richtext': ['RichText', 'PlainText'],
  'datetime': ['Date', 'PlainText'],
  'boolean': ['Switch', 'PlainText'],
  'number': ['Number', 'PlainText'],
  'url': ['Link', 'PlainText', 'Image']
};

export default function FieldMappingEditor({ 
  mappings = [], 
  webflowFields = [], 
  onChange,
  errors = []
}) {
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (index) => {
    setExpandedRows(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const addMapping = () => {
    onChange([...mappings, { 
      pco_field: '', 
      webflow_field: '', 
      webflow_field_type: '',
      transform: 'none',
      transform_config: {}
    }]);
  };

  const removeMapping = (index) => {
    onChange(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index, field, value) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-set webflow field type when selecting webflow field
    if (field === 'webflow_field') {
      const wfField = webflowFields.find(f => f.slug === value);
      if (wfField) {
        updated[index].webflow_field_type = wfField.type;
      }
    }
    
    onChange(updated);
  };

  const getPcoField = (id) => {
    for (const category of Object.values(PCO_FIELDS)) {
      const field = category.find(f => f.id === id);
      if (field) return field;
    }
    return null;
  };

  const isTypeCompatible = (pcoFieldId, webflowFieldType) => {
    const pcoField = getPcoField(pcoFieldId);
    if (!pcoField) return true;
    const compatible = TYPE_COMPATIBILITY[pcoField.type] || [];
    return compatible.includes(webflowFieldType);
  };

  const getRowError = (index) => {
    const mapping = mappings[index];
    if (!mapping.pco_field || !mapping.webflow_field) return null;
    
    if (!isTypeCompatible(mapping.pco_field, mapping.webflow_field_type)) {
      const pcoField = getPcoField(mapping.pco_field);
      return `Type mismatch: ${pcoField?.type} → ${mapping.webflow_field_type}`;
    }
    return null;
  };

  // Check if pco_event_id mapping exists
  const hasEventIdMapping = mappings.some(m => m.pco_field === 'event.id');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Field Mapping</CardTitle>
          <Button size="sm" variant="outline" onClick={addMapping}>
            <Plus className="w-4 h-4 mr-1" />
            Add Mapping
          </Button>
        </div>
        {!hasEventIdMapping && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 rounded-lg text-amber-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Required: Map <strong>Event ID</strong> → <strong>pco_event_id</strong> field</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="mb-2">No field mappings configured</p>
            <p className="text-sm">Click "Add Mapping" to start mapping PCO fields to Webflow fields</p>
          </div>
        ) : (
          mappings.map((mapping, index) => {
            const rowError = getRowError(index);
            const isExpanded = expandedRows[index];
            
            return (
              <Collapsible key={index} open={isExpanded} onOpenChange={() => toggleRow(index)}>
                <div className={`p-3 border rounded-lg ${rowError ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    {/* PCO Field Select */}
                    <div className="flex-1">
                      <Select 
                        value={mapping.pco_field}
                        onValueChange={(v) => updateMapping(index, 'pco_field', v)}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select PCO field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PCO_FIELDS).map(([category, fields]) => (
                            <React.Fragment key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50">
                                {category}
                              </div>
                              {fields.map(field => (
                                <SelectItem key={field.id} value={field.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{field.label}</span>
                                    {field.required && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">Required</Badge>
                                    )}
                                    {field.virtual && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50">Virtual</Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </React.Fragment>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />

                    {/* Webflow Field Select */}
                    <div className="flex-1">
                      <Select 
                        value={mapping.webflow_field}
                        onValueChange={(v) => updateMapping(index, 'webflow_field', v)}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select Webflow field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {webflowFields.map(field => (
                            <SelectItem key={field.slug} value={field.slug}>
                              <div className="flex items-center gap-2">
                                <span>{field.displayName || field.slug}</span>
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {field.type}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Transform indicator & expand */}
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="px-2">
                        <Settings2 className="w-4 h-4 mr-1" />
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </Button>
                    </CollapsibleTrigger>

                    {/* Remove */}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeMapping(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {rowError && (
                    <div className="flex items-center gap-1 mt-2 text-amber-600 text-xs">
                      <AlertCircle className="w-3 h-3" />
                      {rowError}
                    </div>
                  )}

                  <CollapsibleContent className="mt-3 pt-3 border-t">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-slate-500">Transform</Label>
                        <Select 
                          value={mapping.transform || 'none'}
                          onValueChange={(v) => updateMapping(index, 'transform', v)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TRANSFORMS.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Transform config based on type */}
                      {mapping.transform === 'static' && (
                        <div>
                          <Label className="text-xs text-slate-500">Static Value</Label>
                          <Input
                            className="mt-1"
                            placeholder="Enter static value..."
                            value={mapping.transform_config?.value || ''}
                            onChange={(e) => updateMapping(index, 'transform_config', { value: e.target.value })}
                          />
                        </div>
                      )}

                      {mapping.transform === 'fallback' && (
                        <div>
                          <Label className="text-xs text-slate-500">Fallback Value</Label>
                          <Input
                            className="mt-1"
                            placeholder="Value if empty..."
                            value={mapping.transform_config?.fallback || ''}
                            onChange={(e) => updateMapping(index, 'transform_config', { fallback: e.target.value })}
                          />
                        </div>
                      )}

                      {mapping.transform === 'date_format' && (
                        <div>
                          <Label className="text-xs text-slate-500">Date Format</Label>
                          <Input
                            className="mt-1"
                            placeholder="e.g., YYYY-MM-DD"
                            value={mapping.transform_config?.format || ''}
                            onChange={(e) => updateMapping(index, 'transform_config', { format: e.target.value })}
                          />
                        </div>
                      )}

                      {mapping.transform === 'combine' && (
                        <div>
                          <Label className="text-xs text-slate-500">Combine Pattern</Label>
                          <Input
                            className="mt-1"
                            placeholder="e.g., {event.name} - {event.location_name}"
                            value={mapping.transform_config?.pattern || ''}
                            onChange={(e) => updateMapping(index, 'transform_config', { pattern: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}