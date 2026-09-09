import React, { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Plus, Trash2, Tag, Search, Sparkles } from 'lucide-react';
import Tilt3DCard from './Tilt3DCard';
import { apiFetch } from '../lib/api';

export default function ColumnMappingInspector() {
  const [mappingData, setMappingData] = useState(null);
  const [testHeader, setTestHeader] = useState('');
  const [matchedField, setMatchedField] = useState(null);
  const [searchField, setSearchField] = useState('');
  const [newAliasText, setNewAliasText] = useState({});
  const [isSavingAlias, setIsSavingAlias] = useState(false);

  useEffect(() => {
    fetchMapping();
  }, []);

  const fetchMapping = async () => {
    try {
      const res = await apiFetch('/api/column-mappings');
      if (res.ok) {
        const data = await res.json();
        setMappingData(data);
      }
    } catch (err) {
      console.error('Error loading column mappings:', err);
    }
  };

  const handleTestMatch = (query) => {
    setTestHeader(query);
    if (!query.trim() || !mappingData?.aliases) {
      setMatchedField(null);
      return;
    }

    const cleanQuery = query.trim().toUpperCase();
    for (const [targetField, aliasList] of Object.entries(mappingData.aliases)) {
      for (const alias of aliasList) {
        if (alias.toString().toUpperCase() === cleanQuery) {
          setMatchedField(targetField);
          return;
        }
      }
    }
    setMatchedField('UNMAPPED / REQUIRES ALIAS');
  };

  const handleAddAlias = async (targetField) => {
    const aliasVal = newAliasText[targetField]?.trim();
    if (!aliasVal) return;

    setIsSavingAlias(true);
    try {
      const res = await apiFetch('/api/column-mappings/alias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_field: targetField, alias: aliasVal }),
      });
      if (res.ok) {
        const updatedData = await res.json();
        setMappingData(updatedData);
        setNewAliasText((prev) => ({ ...prev, [targetField]: '' }));
      }
    } catch (err) {
      console.error('Failed to add custom alias:', err);
    } finally {
      setIsSavingAlias(false);
    }
  };

  const handleRemoveAlias = async (targetField, aliasVal) => {
    try {
      const res = await apiFetch('/api/column-mappings/alias', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_field: targetField, alias: aliasVal }),
      });
      if (res.ok) {
        const updatedData = await res.json();
        setMappingData(updatedData);
      }
    } catch (err) {
      console.error('Failed to remove custom alias:', err);
    }
  };

  if (!mappingData) {
    return (
      <div className="p-12 text-center text-[var(--text-3)] font-mono text-xs space-y-2">
        <Sparkles className="w-6 h-6 animate-pulse text-[var(--accent)] mx-auto" />
        <p>Loading Neumorphic 23-Field Standard Mapping Catalog...</p>
      </div>
    );
  }

  const targetFields = mappingData.target_fields || [];
  const aliases = mappingData.aliases || {};

  const filteredFields = targetFields.filter((field) =>
    field.toLowerCase().includes(searchField.toLowerCase()) ||
    (aliases[field] && aliases[field].some((a) => a.toLowerCase().includes(searchField.toLowerCase())))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title Header */}
      <Tilt3DCard className="p-6 rounded-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--text)] tracking-tight">Column schema</h2>
            <p className="text-xs text-[var(--text-2)] mt-1 font-medium">
              Dynamic alias management engine. Add or remove raw header aliases permanently to standard database target fields.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-[var(--surface-2)] px-4 py-2.5 rounded-lg border border-[var(--edge)] font-mono text-xs">
            <Tag className="w-4 h-4 text-[var(--ok)]" />
            <span className="text-[var(--text-2)]">Total Active Aliases:</span>
            <span className="text-[var(--text)] font-semibold">{mappingData.alias_count?.toLocaleString()}</span>
          </div>
        </div>
      </Tilt3DCard>

      {/* Header Matcher Tester Tool */}
      <Tilt3DCard className="p-6 space-y-4">
        <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--text-2)] font-mono">
          <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
          <span>HEADER ALIAS MATCHER TESTER</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={testHeader}
            onChange={(e) => handleTestMatch(e.target.value)}
            placeholder="Type raw header (e.g. FULL NAME, DAR UNIT_NO, REGION, MASTER DEVELOPER, PROPERTY TOWER)..."
            className="flex-1 field text-xs text-[var(--text)] rounded-lg px-4 py-3 focus:outline-none font-mono"
          />
        </div>

        {testHeader && (
          <div className="p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--edge)] text-xs font-mono flex items-center justify-between">
            <span className="text-[var(--text-2)] font-medium">Raw Input Header: "<span className="text-[var(--text)] font-semibold">{testHeader}</span>"</span>
            <div className="flex items-center space-x-2">
              <ArrowRight className="w-4 h-4 text-[var(--accent)]" />
              <span className={`font-semibold px-3 py-1 rounded-xl text-xs ${matchedField && matchedField !== 'UNMAPPED / REQUIRES ALIAS' ? 'bg-emerald-100 text-[var(--ok)] border border-emerald-300' : 'bg-rose-100 text-[var(--bad)] border border-rose-300'}`}>
                {matchedField}
              </span>
            </div>
          </div>
        )}
      </Tilt3DCard>

      {/* Mapping Cards Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--text)] flex items-center space-x-2 font-mono">
            <span>Target Fields & Known Aliases ({filteredFields.length})</span>
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--accent)] absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
              placeholder="Search target fields or aliases..."
              className="field text-xs text-[var(--text)] rounded-lg pl-10 pr-4 py-2.5 focus:outline-none font-medium w-64"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFields.map((field) => {
            const aliasList = aliases[field] || [];
            return (
              <Tilt3DCard key={field} className="p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-[var(--edge)] pb-3">
                    <h4 className="text-xs font-semibold text-[var(--text)] font-mono tracking-wide">{field}</h4>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--accent)] font-semibold border border-[var(--edge)]">
                      {aliasList.length} Aliases
                    </span>
                  </div>

                  <div className="bg-[var(--surface-2)] p-3.5 rounded-lg border border-[var(--edge)] max-h-48 overflow-y-auto font-mono text-[11px] space-y-1.5 divide-y divide-[var(--edge)]">
                    {aliasList.length > 0 ? (
                      aliasList.map((alias, idx) => (
                        <div key={idx} className="pt-1.5 flex items-center justify-between group text-[var(--text-2)] hover:text-[var(--text)]">
                          <span className="truncate pr-2">• {alias}</span>
                          <button
                            onClick={() => handleRemoveAlias(field, alias)}
                            className="p-1 rounded-md text-[var(--text-3)] hover:text-[var(--bad)] hover:bg-rose-100 transition-all opacity-70 group-hover:opacity-100 cursor-pointer"
                            title="Remove Alias"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-[var(--text-3)] italic text-[10px]">Standard direct match</span>
                    )}
                  </div>
                </div>

                {/* Add Custom Alias Form */}
                <div className="flex items-center space-x-2 pt-2 border-t border-[var(--edge)]">
                  <input
                    type="text"
                    value={newAliasText[field] || ''}
                    onChange={(e) => setNewAliasText({ ...newAliasText, [field]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddAlias(field);
                    }}
                    placeholder="Add new custom alias..."
                    className="flex-1 field text-[11px] text-[var(--text)] px-3.5 py-2 rounded-xl focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => handleAddAlias(field)}
                    disabled={isSavingAlias || !newAliasText[field]?.trim()}
                    className="btn-primary px-3.5 py-2 text-xs font-semibold flex items-center space-x-1"
                    title="Save Alias Permanently"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </Tilt3DCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
