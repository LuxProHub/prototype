import React, { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Plus, Trash2, Tag, Search } from 'lucide-react';
import { apiFetch } from '../lib/api';
import PageHeader from './ui/PageHeader';
import { ErrorState, LoadingRows } from './ui/States';

export default function ColumnMappingInspector() {
  const [mappingData, setMappingData] = useState(null);
  const [testHeader, setTestHeader] = useState('');
  const [matchedField, setMatchedField] = useState(null);
  const [searchField, setSearchField] = useState('');
  const [newAliasText, setNewAliasText] = useState({});
  const [isSavingAlias, setIsSavingAlias] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    fetchMapping();
  }, []);

  const fetchMapping = async () => {
    try {
      const res = await apiFetch('/api/column-mappings');
      if (!res.ok) {
        setLoadError(`The server answered ${res.status}.`);
        return;
      }
      setMappingData(await res.json());
      setLoadError(null);
    } catch (err) {
      console.error('Error loading column mappings:', err);
      setLoadError('Could not reach the server.');
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

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 max-w-[1520px] mx-auto">
        <PageHeader title="Column schema" description="Raw header aliases mapped to canonical database fields." />
        <ErrorState error={loadError} onRetry={fetchMapping} title="Column schema could not be loaded" />
      </div>
    );
  }

  if (!mappingData) {
    return (
      <div className="p-4 sm:p-6 max-w-[1520px] mx-auto space-y-4">
        <PageHeader title="Column schema" description="Raw header aliases mapped to canonical database fields." />
        <LoadingRows rows={6} />
      </div>
    );
  }

  const targetFields = mappingData.target_fields || [];
  const aliases = mappingData.aliases || {};

  const filteredFields = targetFields.filter(
    (field) =>
      field.toLowerCase().includes(searchField.toLowerCase()) ||
      (aliases[field] && aliases[field].some((a) => a.toLowerCase().includes(searchField.toLowerCase())))
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1520px] mx-auto space-y-6 animate-fade-in">
      {/* Title Header */}
      <PageHeader
        title="Column schema"
        description="Raw header aliases mapped to canonical database fields. Add an alias here and every future upload recognises it."
        actions={
          <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] px-3 h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[12.5px]">
            <Tag className="w-3.5 h-3.5 text-[var(--color-ok)]" />
            <span className="text-[var(--color-text-secondary)]">Active aliases:</span>
            <span className="num text-[var(--color-text-primary)] font-bold">
              {mappingData.alias_count?.toLocaleString()}
            </span>
          </div>
        }
      />

      {/* Header Matcher Interactive Tester Tool */}
      <div className="bento-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold text-[var(--color-text-secondary)] font-mono">
          <ShieldCheck className="w-4 h-4 text-[var(--color-accent)]" />
          <span>HEADER ALIAS MATCHER TESTER</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={testHeader}
            onChange={(e) => handleTestMatch(e.target.value)}
            placeholder="Type raw header (e.g. FULL NAME, DAR UNIT_NO, REGION, MASTER DEVELOPER, PROPERTY TOWER)..."
            className="flex-1 field text-xs text-[var(--color-text-primary)] rounded-[var(--radius-md)] px-4 py-2.5 focus:outline-none font-mono"
          />
        </div>

        {testHeader && (
          <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="text-[var(--color-text-secondary)] font-medium">
              Raw Input Header: "<span className="text-[var(--color-text-primary)] font-bold">{testHeader}</span>"
            </span>
            <div className="flex items-center space-x-2">
              <ArrowRight className="w-4 h-4 text-[var(--color-accent)]" />
              <span
                className={`font-bold px-3 py-1 rounded-full text-[11px] border ${
                  matchedField && matchedField !== 'UNMAPPED / REQUIRES ALIAS'
                    ? 'bg-[var(--color-ok-soft,#34d39920)] text-[var(--color-ok)] border-[var(--color-ok)]/30'
                    : 'bg-[var(--color-bad-soft,#fb718520)] text-[var(--color-bad)] border-[var(--color-bad)]/30'
                }`}
              >
                {matchedField}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Target Fields & Aliases Bento Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center space-x-2 font-mono">
            <span>Target Fields & Known Aliases ({filteredFields.length})</span>
          </h3>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--color-accent)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
              placeholder="Search fields or aliases..."
              className="field text-xs text-[var(--color-text-primary)] rounded-[var(--radius-md)] pl-8 pr-3 h-8 focus:outline-none font-medium w-64"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredFields.map((field) => {
            const aliasList = aliases[field] || [];
            return (
              <div
                key={field}
                className="bento-card p-5 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-2.5">
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)] font-mono tracking-wide">
                      {field}
                    </h4>
                    <span className="neo-tag">
                      {aliasList.length} Aliases
                    </span>
                  </div>

                  <div className="bg-[var(--color-surface-elevated)] p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] max-h-44 overflow-y-auto font-mono text-[11px] space-y-1.5 divide-y divide-[var(--color-border)]">
                    {aliasList.length > 0 ? (
                      aliasList.map((alias, idx) => (
                        <div
                          key={idx}
                          className="pt-1.5 first:pt-0 flex items-center justify-between group text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        >
                          <span className="truncate pr-2">• {alias}</span>
                          <button
                            onClick={() => handleRemoveAlias(field, alias)}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-bad)] hover:bg-[var(--color-bad-soft,#fb718520)] transition-all opacity-60 group-hover:opacity-100 cursor-pointer"
                            title="Remove Alias"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-[var(--color-text-muted)] italic text-[10.5px]">
                        Standard direct match only
                      </span>
                    )}
                  </div>
                </div>

                {/* Add Custom Alias Form */}
                <div className="flex items-center space-x-2 pt-2 border-t border-[var(--color-border)]">
                  <input
                    type="text"
                    value={newAliasText[field] || ''}
                    onChange={(e) => setNewAliasText({ ...newAliasText, [field]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddAlias(field);
                    }}
                    placeholder="Add custom alias..."
                    className="flex-1 field text-[11px] text-[var(--color-text-primary)] px-2.5 h-7 rounded-[var(--radius-sm)] focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => handleAddAlias(field)}
                    disabled={isSavingAlias || !newAliasText[field]?.trim()}
                    className="btn-primary h-7 px-2.5 text-[11px] font-semibold flex items-center gap-1 shrink-0"
                    title="Save Alias"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
