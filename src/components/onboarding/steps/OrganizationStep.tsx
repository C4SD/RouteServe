import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, Mail, Phone, Globe, MapPin, Truck, X, Search, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCountries } from '@/hooks/onboarding/useCountries';
import { useAdminUnitsByCountry } from '@/hooks/onboarding/useAdminUnitsByCountry';
import { useAdminUnitsByParent } from '@/hooks/onboarding/useAdminUnitsByParent';
import { OPERATING_MODELS, ORG_TYPES, SECTORS } from '@/types/onboarding';
import type { OperatingModel, OrgType, Sector } from '@/types/onboarding';
import type { useOnboardingWizard } from '@/hooks/onboarding/useOnboardingWizard';

interface CountryMultiSelectProps {
  countries: { id: string; name: string }[];
  selectedIds: string[];
  primaryId: string | null;
  onToggle: (id: string) => void;
  getCountryName: (id: string) => string;
}

function CountryMultiSelect({ countries, selectedIds, primaryId, onToggle, getCountryName }: CountryMultiSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = search.trim()
    ? countries.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : countries;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="space-y-2">
      {/* Selected badges */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map(cid => (
            <Badge
              key={cid}
              variant="secondary"
              className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 pr-1"
            >
              {getCountryName(cid)}
              {primaryId === cid && (
                <span className="ml-1 text-[10px] text-emerald-400">(Primary)</span>
              )}
              <button
                onClick={() => onToggle(cid)}
                className="ml-1.5 p-0.5 rounded hover:bg-emerald-500/30 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search + dropdown */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search countries..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="h-10 pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500"
          />
          {selectedIds.length > 0 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
              {selectedIds.length} selected
            </span>
          )}
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-zinc-500 text-center">No countries found</div>
            ) : (
              filtered.map(country => {
                const isSelected = selectedIds.includes(country.id);
                return (
                  <button
                    key={country.id}
                    onClick={() => onToggle(country.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${
                      isSelected
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-zinc-600'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span>{country.name}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface OrganizationStepProps {
  wizard: ReturnType<typeof useOnboardingWizard>;
}

type NameStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function OrganizationStep({ wizard }: OrganizationStepProps) {
  const { state, setOrgName, updateField, createOrganization } = wizard;
  const { data: countries, isLoading: loadingCountries } = useCountries();
  const { data: adminUnits, isLoading: loadingStates } = useAdminUnitsByCountry(
    state.selectedCountryIds,
    4
  );

  const [nameStatus, setNameStatus] = useState<NameStatus>('idle');
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkNameAvailability = useCallback(async (name: string, slug: string) => {
    setNameStatus('checking');
    const { data } = await supabase.rpc('check_workspace_name_available', {
      p_name: name,
      p_slug: slug,
    });
    if (data) {
      setNameStatus(data.available ? 'available' : 'taken');
    } else {
      setNameStatus('idle');
    }
  }, []);

  const handleOrgNameChange = useCallback((name: string) => {
    setOrgName(name);
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    if (name.trim().length < 2) {
      setNameStatus('idle');
      return;
    }
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    checkTimerRef.current = setTimeout(() => checkNameAvailability(name.trim(), slug), 600);
  }, [setOrgName, checkNameAvailability]);

  const handleSubmit = () => {
    if (!state.orgName.trim()) return;
    if (state.selectedCountryIds.length === 0) return;
    if (nameStatus === 'taken') return;
    createOrganization.mutate();
  };

  const isValid =
    state.orgName.trim().length >= 2 &&
    state.selectedCountryIds.length > 0 &&
    state.operatingModel !== null &&
    nameStatus !== 'taken';

  const toggleCountry = (countryId: string) => {
    const current = state.selectedCountryIds;
    if (current.includes(countryId)) {
      const next = current.filter(id => id !== countryId);
      updateField('selectedCountryIds', next);
      // Update primary if removed
      if (state.primaryCountryId === countryId) {
        updateField('primaryCountryId', next[0] || null);
      }
      // Clear states and LGAs for removed country
      if (adminUnits) {
        const removedStates = adminUnits
          .filter(u => u.country_id === countryId)
          .map(u => u.id);
        updateField(
          'selectedStateIds',
          state.selectedStateIds.filter(id => !removedStates.includes(id))
        );
        // Clear LGAs that belonged to removed states
        if (lgaUnits) {
          const removedLgas = lgaUnits
            .filter(u => removedStates.includes(u.parent_id))
            .map(u => u.id);
          updateField(
            'selectedLgaIds',
            state.selectedLgaIds.filter(id => !removedLgas.includes(id))
          );
        }
      }
    } else {
      const next = [...current, countryId];
      updateField('selectedCountryIds', next);
      if (!state.primaryCountryId) {
        updateField('primaryCountryId', countryId);
      }
    }
  };

  const toggleState = (stateId: string) => {
    const current = state.selectedStateIds;
    if (current.includes(stateId)) {
      updateField('selectedStateIds', current.filter(id => id !== stateId));
      // Clear LGAs for removed state
      if (lgaUnits) {
        const removedLgas = lgaUnits
          .filter(u => u.parent_id === stateId)
          .map(u => u.id);
        updateField(
          'selectedLgaIds',
          state.selectedLgaIds.filter(id => !removedLgas.includes(id))
        );
      }
    } else {
      updateField('selectedStateIds', [...current, stateId]);
    }
  };

  // Fetch LGAs for selected states
  const { data: lgaUnits, isLoading: loadingLgas } = useAdminUnitsByParent(
    state.selectedStateIds,
    6
  );

  const toggleLga = (lgaId: string) => {
    const current = state.selectedLgaIds;
    if (current.includes(lgaId)) {
      updateField('selectedLgaIds', current.filter(id => id !== lgaId));
    } else {
      updateField('selectedLgaIds', [...current, lgaId]);
    }
  };

  // Group LGAs by parent state for display
  const lgasByState = (lgaUnits || []).reduce<Record<string, typeof lgaUnits>>((acc, lga) => {
    if (!acc[lga.parent_id]) acc[lga.parent_id] = [];
    acc[lga.parent_id]!.push(lga);
    return acc;
  }, {});

  const getStateName = (stateId: string) => {
    return adminUnits?.find(u => u.id === stateId)?.name || stateId;
  };

  const getCountryName = (countryId: string) => {
    return countries?.find(c => c.id === countryId)?.name || countryId;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mb-4">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-semibold text-white">Set Up Your Organization</h1>
        <p className="text-zinc-400">
          Create your workspace and configure your organization profile.
        </p>
      </div>

      {/* Section 1: Organization Identity */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-white">Organization Identity</h2>

        <div className="space-y-2">
          <Label htmlFor="orgName" className="text-zinc-300">
            Organization Name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="orgName"
            placeholder="e.g., Kano State Primary Health Care"
            value={state.orgName}
            onChange={(e) => handleOrgNameChange(e.target.value)}
            className={`h-12 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500 ${nameStatus === 'taken' ? 'border-red-500' : nameStatus === 'available' ? 'border-emerald-500' : ''}`}
          />
          {nameStatus === 'checking' && (
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking availability…
            </p>
          )}
          {nameStatus === 'available' && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Check className="w-3 h-3" />
              Name available
            </p>
          )}
          {nameStatus === 'taken' && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="w-3 h-3" />
              This organization name is already registered
            </p>
          )}
          {state.orgSlug && (
            <p className="text-xs text-zinc-500">
              Workspace URL: <span className="text-zinc-400">{state.orgSlug}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">Organization Type</Label>
            <Select
              value={state.orgType || ''}
              onValueChange={(v) => updateField('orgType', v as OrgType)}
            >
              <SelectTrigger className="h-12 bg-zinc-900 border-zinc-800 text-white">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Sector</Label>
            <Select
              value={state.sector || ''}
              onValueChange={(v) => updateField('sector', v as Sector)}
            >
              <SelectTrigger className="h-12 bg-zinc-900 border-zinc-800 text-white">
                <SelectValue placeholder="Select sector" />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Section 2: Contact Information */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-white">Contact Information</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                type="email"
                placeholder="org@example.com"
                value={state.contactEmail}
                onChange={(e) => updateField('contactEmail', e.target.value)}
                className="h-12 pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                type="tel"
                placeholder="+234 800 000 0000"
                value={state.contactPhone}
                onChange={(e) => updateField('contactPhone', e.target.value)}
                className="h-12 pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-300">
            Fax <span className="text-zinc-600">(optional)</span>
          </Label>
          <Input
            type="tel"
            placeholder="Fax number"
            value={state.fax}
            onChange={(e) => updateField('fax', e.target.value)}
            className="h-12 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Section 3: Operating Region */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-white">Operating Region</h2>

        <div className="space-y-2">
          <Label className="text-zinc-300">
            <Globe className="inline w-4 h-4 mr-1" />
            Countries <span className="text-red-400">*</span>
          </Label>
          <p className="text-xs text-zinc-500">Select all countries where you operate.</p>

          {loadingCountries ? (
            <div className="flex items-center gap-2 text-zinc-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading countries...</span>
            </div>
          ) : (
            <CountryMultiSelect
              countries={countries || []}
              selectedIds={state.selectedCountryIds}
              primaryId={state.primaryCountryId}
              onToggle={toggleCountry}
              getCountryName={getCountryName}
            />
          )}
        </div>

        {/* States/Regions */}
        {state.selectedCountryIds.length > 0 && (
          <div className="space-y-2">
            <Label className="text-zinc-300">
              <MapPin className="inline w-4 h-4 mr-1" />
              States / Regions <span className="text-zinc-600">(optional)</span>
            </Label>
            <p className="text-xs text-zinc-500">
              Select specific states where you operate, or leave empty for country-wide.
            </p>

            {loadingStates ? (
              <div className="flex items-center gap-2 text-zinc-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading states...</span>
              </div>
            ) : adminUnits && adminUnits.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                {adminUnits.map(unit => (
                  <button
                    key={unit.id}
                    onClick={() => toggleState(unit.id)}
                    className={`px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                      state.selectedStateIds.includes(unit.id)
                        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {unit.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-2">
                No administrative boundaries imported yet. You can import them later from Settings.
              </p>
            )}
          </div>
        )}

        {/* LGAs / Local Government Areas */}
        {state.selectedStateIds.length > 0 && (
          <div className="space-y-2">
            <Label className="text-zinc-300">
              <MapPin className="inline w-4 h-4 mr-1" />
              Local Government Areas (LGAs) <span className="text-zinc-600">(optional)</span>
            </Label>
            <p className="text-xs text-zinc-500">
              Select specific LGAs where you operate, or leave empty for state-wide.
            </p>

            {loadingLgas ? (
              <div className="flex items-center gap-2 text-zinc-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading LGAs...</span>
              </div>
            ) : lgaUnits && lgaUnits.length > 0 ? (
              <div className="space-y-4 max-h-64 overflow-y-auto p-1">
                {Object.entries(lgasByState).map(([parentId, lgas]) => (
                  <div key={parentId}>
                    <p className="text-xs font-medium text-zinc-400 mb-2">
                      {getStateName(parentId)}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(lgas || []).map(lga => (
                        <button
                          key={lga.id}
                          onClick={() => toggleLga(lga.id)}
                          className={`px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                            state.selectedLgaIds.includes(lga.id)
                              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          {lga.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-2">
                No LGA boundaries available for the selected states.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Operating Model */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-white">
          <Truck className="inline w-5 h-5 mr-1" />
          Operating Model <span className="text-red-400">*</span>
        </h2>
        <p className="text-xs text-zinc-500">How does your organization handle deliveries?</p>

        <RadioGroup
          value={state.operatingModel || ''}
          onValueChange={(v) => updateField('operatingModel', v as OperatingModel)}
          className="space-y-3"
        >
          {OPERATING_MODELS.map(model => (
            <label
              key={model.value}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                state.operatingModel === model.value
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <RadioGroupItem value={model.value} className="mt-0.5" />
              <div>
                <span className="text-sm font-medium text-white">{model.label}</span>
                <p className="text-xs text-zinc-500 mt-0.5">{model.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Submit */}
      <div className="pt-4 border-t border-zinc-800">
        <Button
          onClick={handleSubmit}
          disabled={!isValid || createOrganization.isPending}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
        >
          {createOrganization.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Creating Organization...
            </>
          ) : (
            'Create Organization & Continue'
          )}
        </Button>
      </div>
    </div>
  );
}
