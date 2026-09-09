import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  SearchX,
  SlidersHorizontal,
} from 'lucide-react';
import CustomSelect from './CustomSelect';
import { apiFetch } from '../lib/api';
import { useToast } from '../lib/toast';
import AddToQueueDialog from './AddToQueueDialog';
import RecordInspector from './RecordInspector';
import BulkActionBar from './BulkActionBar';
import ColumnVisibilityMenu from './ColumnVisibilityMenu';
import { StatusDot } from './ui/Badge';
import { FilterChip } from './ui/FilterBar';

/** Render a result count, marking it as a floor when the API capped its count. */
function formatTotal(total, capped) {
  return capped ? `${total.toLocaleString()}+` : total.toLocaleString();
}

function formatAed(v) {
  return v ? `AED ${Number(v).toLocaleString('en-US')}` : null;
}

const ALL_COLUMNS = [
  { key: 'name', label: 'Name', minWidth: 'min-w-[220px]' },
  { key: 'developer', label: 'Developer', minWidth: 'min-w-[150px]' },
  { key: 'community', label: 'Community', minWidth: 'min-w-[140px]' },
  { key: 'building_cluster', label: 'Building', minWidth: 'min-w-[140px]' },
  { key: 'unit_number', label: 'Unit', minWidth: 'min-w-[90px]' },
  { key: 'bedroom', label: 'Bedroom', minWidth: 'min-w-[90px]' },
  { key: 'procedure_value', label: 'Value (AED)', minWidth: 'min-w-[130px]', align: 'right' },
  { key: 'mobile_1', label: 'Mobile', minWidth: 'min-w-[130px]' },
];

/**
 * Memoized table row to prevent re-rendering during search typing.
 */
const RecordRow = React.memo(function RecordRow({
  r,
  onSelect,
  checked,
  onToggle,
  isSelectedRow,
  visibleCols,
}) {
  const open = () => onSelect(r);
  return (
    <tr
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      tabIndex={0}
      className={`group cursor-pointer transition-colors ${
        isSelectedRow ? 'bg-[var(--color-accent-soft)] hover:bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)]' : ''
      }`}
      data-selected={checked || isSelectedRow || undefined}
    >
      <td className="w-9 pr-0" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(r.id)}
          onKeyDown={(e) => e.stopPropagation()}
          className="accent-[var(--color-accent)] w-3.5 h-3.5 align-middle cursor-pointer"
          aria-label={`Select ${r.name || `record ${r.id}`}`}
        />
      </td>

      {visibleCols.name !== false && (
        <td className="max-w-[260px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <StatusDot status={r.status} />
            <span
              className="truncate font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors"
              title={r.name || ''}
            >
              {r.name || <span className="text-[var(--color-text-muted)] font-normal">Unnamed</span>}
            </span>
            {r.status === 'DUPLICATE' && <span className="badge badge-dup">dup</span>}
          </div>
        </td>
      )}

      {visibleCols.developer !== false && (
        <td className="max-w-[170px] truncate text-[var(--color-text-secondary)]" title={r.developer || ''}>
          {r.developer || '—'}
        </td>
      )}

      {visibleCols.community !== false && (
        <td className="max-w-[150px] truncate text-[var(--color-text-secondary)]" title={r.community || ''}>
          {r.community || '—'}
        </td>
      )}

      {visibleCols.building_cluster !== false && (
        <td className="max-w-[150px] truncate text-[var(--color-text-secondary)]" title={r.building_cluster || r.building || ''}>
          {r.building_cluster || r.building || '—'}
        </td>
      )}

      {visibleCols.unit_number !== false && (
        <td className="val whitespace-nowrap">
          {r.unit_number || r.unit || (r.plot_number ? `Plot ${r.plot_number}` : '—')}
        </td>
      )}

      {visibleCols.bedroom !== false && (
        <td className="whitespace-nowrap text-[var(--color-text-secondary)]">
          {r.bedroom || r.bedroom_type || '—'}
        </td>
      )}

      {visibleCols.procedure_value !== false && (
        <td className="val whitespace-nowrap text-right font-medium">
          {formatAed(r.procedure_value) || <span className="text-[var(--color-text-muted)] font-normal">—</span>}
        </td>
      )}

      {visibleCols.mobile_1 !== false && (
        <td className="num whitespace-nowrap text-[var(--color-text-secondary)]">
          {r.mobile_1 || r.mobile || '—'}
        </td>
      )}
    </tr>
  );
});

const PAGE_SIZES = [25, 50, 100];

export default function RecordsExplorer({ initialQuery = '', onNavigate }) {
  const { notify } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [queueOpen, setQueueOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [isExporting, setIsExporting] = useState(null); // 'csv' | 'xlsx' | null
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const activeRequestRef = useRef(0);

  // Filters
  const [community, setCommunity] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [bedroom, setBedroom] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalCapped, setTotalCapped] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    communities: [],
    property_types: [],
    bedroom_types: [],
    statuses: [],
  });

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('datalink_visible_columns');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Active Inspector Record
  const [selectedRecord, setSelectedRecord] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    setSearch(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedRecord(null);
        return;
      }

      if (e.key === '/' && !selectedRecord) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // Next / Previous record with arrow keys when inspector is open
      if (selectedRecord && records.length > 0) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        const currentIdx = records.findIndex((r) => r.id === selectedRecord.id);
        if (e.key === 'ArrowDown' && currentIdx < records.length - 1) {
          e.preventDefault();
          setSelectedRecord(records[currentIdx + 1]);
        } else if (e.key === 'ArrowUp' && currentIdx > 0) {
          e.preventDefault();
          setSelectedRecord(records[currentIdx - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRecord, records]);

  useEffect(() => {
    apiFetch('/api/records/filters')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setFilterOptions({
          communities: (data.communities || []).filter(
            (c) => c && !c.toLowerCase().includes('owner detail') && !c.toLowerCase().includes('total owner')
          ),
          property_types: data.property_types || [],
          bedroom_types: data.bedrooms || data.bedroom_types || [],
          statuses: data.statuses || ['VALID', 'DUPLICATE', 'INCOMPLETE', 'ERROR'],
        });
      })
      .catch(() => {});

    apiFetch('/api/auth/users')
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => setAssignableUsers(Array.isArray(list) ? list : []))
      .catch(() => setAssignableUsers([]));
  }, []);

  const fetchRecords = useCallback(async () => {
    const currentReq = ++activeRequestRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      if (debouncedSearch) params.append('q', debouncedSearch);
      if (community) params.append('community', community);
      if (propertyType) params.append('property_type', propertyType);
      if (bedroom) params.append('bedroom', bedroom);
      if (status) params.append('status', status);
      if (page > 1 && totalRecords > 0) params.append('total_hint', totalRecords.toString());

      const res = await apiFetch(`/api/records?${params.toString()}`);
      if (currentReq !== activeRequestRef.current) return;

      if (res.ok) {
        const data = await res.json();
        const items = data.items || data.records || [];
        setRecords(items);
        setTotalPages(data.total_pages || 1);
        setTotalRecords(data.total || 0);
        setTotalCapped(Boolean(data.total_capped));
        setLoadError(null);

        // If selected record is in current list, update its reference
        if (selectedRecord) {
          const matched = items.find((r) => r.id === selectedRecord.id);
          if (matched) setSelectedRecord(matched);
        }
      } else {
        setLoadError(`The server answered ${res.status}.`);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      if (currentReq === activeRequestRef.current) {
        setLoadError('Could not reach the server.');
      }
    } finally {
      if (currentReq === activeRequestRef.current) {
        setLoading(false);
      }
    }
  }, [page, limit, sortBy, sortDir, debouncedSearch, community, propertyType, bedroom, status, totalRecords, selectedRecord]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleHeaderSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const toggleSelectAll = () => {
    if (selected.size >= records.length && records.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(records.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleColumn = (colKey) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [colKey]: prev[colKey] === false ? true : false };
      try {
        localStorage.setItem('datalink_visible_columns', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleExport = async (format) => {
    if (isExporting) return;
    setIsExporting(format);
    try {
      const params = new URLSearchParams({
        format: format,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      if (search) params.append('q', search);
      if (community) params.append('community', community);
      if (propertyType) params.append('property_type', propertyType);
      if (bedroom) params.append('bedroom', bedroom);
      if (status) params.append('status', status);

      const res = await apiFetch(`/api/records/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed. Please check query.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `datalink_records_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notify(`${format.toUpperCase()} export downloaded.`, { tone: 'ok' });
    } catch (err) {
      notify(`Export failed: ${err.message}`, { tone: 'bad' });
    } finally {
      setIsExporting(null);
    }
  };

  const clearAllFilters = () => {
    setCommunity('');
    setPropertyType('');
    setBedroom('');
    setStatus('');
    setSearch('');
    setPage(1);
  };

  // Inspector Navigation
  const currentRecordIndex = selectedRecord ? records.findIndex((r) => r.id === selectedRecord.id) : -1;
  const hasPrevRecord = currentRecordIndex > 0;
  const hasNextRecord = currentRecordIndex >= 0 && currentRecordIndex < records.length - 1;

  const navigatePrevRecord = () => {
    if (hasPrevRecord) setSelectedRecord(records[currentRecordIndex - 1]);
  };

  const navigateNextRecord = () => {
    if (hasNextRecord) setSelectedRecord(records[currentRecordIndex + 1]);
  };

  const handleRecordUpdated = (updated) => {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedRecord(updated);
  };

  const from = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(totalRecords, page * limit);
  const anyFilterActive = Boolean(search || community || propertyType || bedroom || status);

  const activeFilterChips = [];
  if (community) activeFilterChips.push({ label: `Community: ${community}`, onRemove: () => setCommunity('') });
  if (propertyType) activeFilterChips.push({ label: `Type: ${propertyType}`, onRemove: () => setPropertyType('') });
  if (bedroom) activeFilterChips.push({ label: `Bedrooms: ${bedroom}`, onRemove: () => setBedroom('') });
  if (status) activeFilterChips.push({ label: `Status: ${status}`, onRemove: () => setStatus('') });

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden relative">
      {/* Top band. Two rows and no more, so the table owns the viewport: the
          title carries the live count (it is the one fact this page has to
          state), and every control sits on a single line with search leading
          and the filters at one consistent width beside it. */}
      <div className="shrink-0 px-4 sm:px-5 pt-3.5 pb-3 border-b border-[var(--edge)] space-y-2.5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="t-title">Records</h1>
            <p className="t-meta mt-1">
              <span className="num text-[var(--text-2)]">{formatTotal(totalRecords, totalCapped)}</span>
              {anyFilterActive ? ' matching' : ' in the register'}
              {totalCapped && <span> · narrow the filter for an exact count</span>}
            </p>
          </div>

          {/* One export control, two formats. Segmented rather than two buttons
              so it reads as a single decision. */}
          <div className="inline-flex shrink-0 rounded-[var(--r-md)] border border-[var(--edge)] overflow-hidden">
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting === 'csv'}
              className="btn h-8 px-2.5 text-[12px] rounded-none border-0"
              title="Export the current view as CSV"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--text-3)]" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={() => handleExport('xlsx')}
              disabled={isExporting === 'xlsx'}
              className="btn h-8 px-2.5 text-[12px] rounded-none border-0 border-l border-l-[var(--edge)]"
              title="Export the current view as XLSX"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--ok)]" />
              <span className="hidden sm:inline">XLSX</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative flex-1 min-w-[220px] max-w-[420px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, community, unit or mobile"
              aria-label="Search records"
              className="field w-full h-8 pl-8 pr-8 text-[12.5px]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost h-5 w-5 text-[var(--text-3)]"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="records-filters"
            className={`btn h-8 w-8 lg:hidden ${showFilters || anyFilterActive ? 'border-[var(--accent-ring)] bg-[var(--accent-soft)]' : ''}`}
            title="Filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          <div id="records-filters" className={`${showFilters ? 'flex' : 'hidden'} lg:flex flex-wrap items-center gap-1.5 w-full lg:w-auto`}>
          <CustomSelect
            value={community}
            onChange={(v) => { setCommunity(v); setPage(1); }}
            options={[{ value: '', label: 'All communities' }, ...filterOptions.communities.map((c) => ({ value: c, label: c }))]}
            placeholder="Community"
            className="w-[176px]"
          />
          <CustomSelect
            value={propertyType}
            onChange={(v) => { setPropertyType(v); setPage(1); }}
            options={[{ value: '', label: 'All property types' }, ...filterOptions.property_types.map((p) => ({ value: p, label: p }))]}
            placeholder="Type"
            className="w-[140px]"
          />
          <CustomSelect
            value={bedroom}
            onChange={(v) => { setBedroom(v); setPage(1); }}
            options={[{ value: '', label: 'All bedrooms' }, ...filterOptions.bedroom_types.map((b) => ({ value: b, label: b }))]}
            placeholder="Bedrooms"
            className="w-[140px]"
          />
          <CustomSelect
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[{ value: '', label: 'All statuses' }, ...filterOptions.statuses.map((s) => ({ value: s, label: s }))]}
            placeholder="Status"
            className="w-[140px]"
          />

          <ColumnVisibilityMenu
            columns={ALL_COLUMNS}
            visibleColumns={visibleColumns}
            onToggleColumn={handleToggleColumn}
          />
          </div>

          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 sm:ml-1 sm:pl-2 sm:border-l sm:border-[var(--edge)]">
              {activeFilterChips.map((chip, idx) => (
                <FilterChip key={idx} label={chip.label} onRemove={chip.onRemove} />
              ))}
              <button
                onClick={clearAllFilters}
                className="btn-ghost h-6 px-2 text-[11px] hover:text-[var(--bad)]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Split Layout: Table on Left/Center, RecordInspector on Right */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Table Container (Layer 1 Operational 2D) */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-9 pr-0">
                    <input
                      type="checkbox"
                      checked={selected.size >= records.length && records.length > 0}
                      onChange={toggleSelectAll}
                      className="accent-[var(--color-accent)] w-3.5 h-3.5 align-middle cursor-pointer"
                      aria-label="Select all rows on page"
                    />
                  </th>

                  {visibleColumns.name !== false && (
                    <th
                      aria-sort={sortBy === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => handleHeaderSort('name')}
                      className="min-w-[220px]"
                    >
                      <div className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <span>Name</span>
                        {sortBy === 'name' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[var(--color-accent)]" /> : <ArrowDown className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                        )}
                      </div>
                    </th>
                  )}

                  {visibleColumns.developer !== false && (
                    <th
                      aria-sort={sortBy === 'developer' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => handleHeaderSort('developer')}
                      className="min-w-[150px]"
                    >
                      <div className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <span>Developer</span>
                        {sortBy === 'developer' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[var(--color-accent)]" /> : <ArrowDown className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                        )}
                      </div>
                    </th>
                  )}

                  {visibleColumns.community !== false && (
                    <th
                      aria-sort={sortBy === 'community' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => handleHeaderSort('community')}
                      className="min-w-[140px]"
                    >
                      <div className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <span>Community</span>
                        {sortBy === 'community' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[var(--color-accent)]" /> : <ArrowDown className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                        )}
                      </div>
                    </th>
                  )}

                  {visibleColumns.building_cluster !== false && (
                    <th className="min-w-[140px]">Building</th>
                  )}

                  {visibleColumns.unit_number !== false && (
                    <th className="min-w-[90px]">Unit</th>
                  )}

                  {visibleColumns.bedroom !== false && (
                    <th className="min-w-[90px]">Bedroom</th>
                  )}

                  {visibleColumns.procedure_value !== false && (
                    <th
                      aria-sort={sortBy === 'procedure_value' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => handleHeaderSort('procedure_value')}
                      className="min-w-[130px] text-right"
                    >
                      <div className="inline-flex items-center justify-end gap-1.5 cursor-pointer select-none w-full">
                        <span>Value (AED)</span>
                        {sortBy === 'procedure_value' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[var(--color-accent)]" /> : <ArrowDown className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                        )}
                      </div>
                    </th>
                  )}

                  {visibleColumns.mobile_1 !== false && (
                    <th className="min-w-[130px]">Mobile</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {loading && !records.length ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={ALL_COLUMNS.length + 1} className="p-3">
                        <div className="h-8 rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)] animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : loadError ? (
                  <tr>
                    <td colSpan={ALL_COLUMNS.length + 1} className="py-14 text-center">
                      <div className="text-[var(--color-bad)] font-semibold text-sm mb-1">Could not load records</div>
                      <p className="text-[12px] text-[var(--color-text-muted)] mb-3">{loadError}</p>
                      <button onClick={fetchRecords} className="btn h-8 px-3 text-[12px]">
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={ALL_COLUMNS.length + 1} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <SearchX className="w-8 h-8 text-[var(--color-text-muted)]" />
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">No records match criteria</div>
                        <p className="text-[12px] text-[var(--color-text-muted)] max-w-sm">
                          {anyFilterActive ? 'Try broadening your search query or resetting filters.' : 'Upload registers to populate the database.'}
                        </p>
                        {anyFilterActive && (
                          <button onClick={clearAllFilters} className="btn h-8 px-3 text-[12px] mt-1">
                            Reset all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <RecordRow
                      key={r.id}
                      r={r}
                      onSelect={(row) => setSelectedRecord(row)}
                      checked={selected.has(r.id)}
                      onToggle={toggleSelectOne}
                      isSelectedRow={selectedRecord?.id === r.id}
                      visibleCols={visibleColumns}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          <div className="shrink-0 px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)] flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px]">
            <div className="hidden md:flex items-center gap-3 text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5"><StatusDot status="VALID" /> Valid</span>
              <span className="flex items-center gap-1.5"><StatusDot status="DUPLICATE" /> Duplicate</span>
              <span className="flex items-center gap-1.5"><StatusDot status="INCOMPLETE" /> Incomplete</span>
              <span className="flex items-center gap-1.5"><StatusDot status="ERROR" /> Error</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-[var(--color-text-secondary)] num">
                {from.toLocaleString()}–{to.toLocaleString()} of {formatTotal(totalRecords, totalCapped)}
              </span>

              <label className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <span className="hidden sm:inline">Rows</span>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  aria-label="Rows per page"
                  className="field h-7 pl-2 pr-1 text-[12px] num cursor-pointer"
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn h-7 w-7"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="num text-[var(--color-text-secondary)] px-1 whitespace-nowrap">
                  {page} <span className="text-[var(--color-text-muted)]">/ {totalPages}</span>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn h-7 w-7"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Persistent Record Inspector (Desktop Split-View / Mobile Drawer) */}
        {selectedRecord && (
          <RecordInspector
            record={selectedRecord}
            onClose={() => setSelectedRecord(null)}
            onRecordUpdated={handleRecordUpdated}
            onPrev={navigatePrevRecord}
            onNext={navigateNextRecord}
            hasPrev={hasPrevRecord}
            hasNext={hasNextRecord}
            onAddToQueue={(id) => {
              setSelected(new Set([id]));
              setQueueOpen(true);
            }}
          />
        )}
      </div>

      {/* Floating Contextual Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selected.size}
        onAddToQueue={() => setQueueOpen(true)}
        onExportCsv={() => handleExport('csv')}
        onExportXlsx={() => handleExport('xlsx')}
        onClear={() => setSelected(new Set())}
        isExporting={Boolean(isExporting)}
      />

      {/* Add To Queue Dialog */}
      {queueOpen && (
        <AddToQueueDialog
          recordIds={[...selected]}
          users={assignableUsers}
          onClose={() => setQueueOpen(false)}
          onDone={(failedIds) => setSelected(new Set(failedIds))}
          onGoToQueue={() => {
            setQueueOpen(false);
            onNavigate?.('queue');
          }}
        />
      )}
    </div>
  );
}
