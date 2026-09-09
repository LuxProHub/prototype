import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit3,
  Save,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Loader2,
  SlidersHorizontal,
  SearchX,
  RotateCcw,
} from 'lucide-react';
import CustomSelect from './CustomSelect';
import { apiFetch } from '../lib/api';
import LeadActivityPanel from './LeadActivityPanel';

/** Render a result count, marking it as a floor when the API capped its count. */
function formatTotal(total, capped) {
  return capped ? `${total.toLocaleString()}+` : total.toLocaleString();
}

function formatAed(v) {
  return v ? `AED ${Number(v).toLocaleString('en-US')}` : null;
}

// One place for what each status means and how it looks.
const STATUS = {
  VALID: { tone: 'ok', label: 'Valid', hint: 'Has a verified name and a phone or email' },
  DUPLICATE: { tone: 'dup', label: 'Duplicate', hint: 'Matches another record by identity hash; kept for audit' },
  INCOMPLETE: { tone: 'warn', label: 'Incomplete', hint: 'Missing name or contact details' },
  ERROR: { tone: 'bad', label: 'Error', hint: 'Failed validation' },
  INVALID: { tone: 'bad', label: 'Invalid', hint: 'Failed validation' },
};
const statusOf = (s) => STATUS[s] || STATUS.VALID;

function StatusDot({ status }) {
  const { tone, label, hint } = statusOf(status);
  return (
    <span
      title={`${label}: ${hint}`}
      className="w-2 h-2 rounded-full shrink-0"
      style={{ background: `var(--${tone})`, boxShadow: `0 0 0 3px var(--${tone}-soft)` }}
    />
  );
}

function StatusBadge({ status }) {
  const { tone, label } = statusOf(status);
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

const COLUMNS = [
  { key: 'name', label: 'Name', className: 'min-w-[220px]' },
  { key: 'developer', label: 'Developer', className: 'min-w-[150px]' },
  { key: 'community', label: 'Community', className: 'min-w-[140px]' },
  { key: 'building_cluster', label: 'Building', className: 'min-w-[140px]' },
  { key: 'unit_number', label: 'Unit', className: 'min-w-[90px]' },
  { key: 'bedroom', label: 'Bedroom', className: 'min-w-[90px]' },
  { key: 'procedure_value', label: 'Value (AED)', className: 'min-w-[130px] text-right', align: 'right' },
  { key: 'mobile_1', label: 'Mobile', className: 'min-w-[130px]' },
];

/** Memoized table row to prevent re-rendering during search typing and modal interaction */
const RecordRow = React.memo(function RecordRow({ r, onSelect }) {
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
      className="group"
    >
      <td className="max-w-[260px]">
        <div className="flex items-center gap-2.5 min-w-0">
          <StatusDot status={r.status} />
          <span className="truncate font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors" title={r.name || ''}>
            {r.name || <span className="text-[var(--text-3)] font-normal">Unnamed</span>}
          </span>
          {r.status === 'DUPLICATE' && <span className="badge badge-dup">dup</span>}
        </div>
      </td>
      <td className="max-w-[180px] truncate" title={r.developer || ''}>{r.developer || '—'}</td>
      <td className="max-w-[160px] truncate" title={r.community || ''}>{r.community || '—'}</td>
      <td className="max-w-[160px] truncate" title={r.building_cluster || r.building || ''}>{r.building_cluster || r.building || '—'}</td>
      <td className="val whitespace-nowrap">{r.unit_number || r.unit || (r.plot_number ? `Plot ${r.plot_number}` : '—')}</td>
      <td className="whitespace-nowrap">{r.bedroom || r.bedroom_type || '—'}</td>
      <td className="val whitespace-nowrap text-right">{formatAed(r.procedure_value) || <span className="text-[var(--text-3)]">—</span>}</td>
      <td className="num whitespace-nowrap">{r.mobile_1 || r.mobile || '—'}</td>
    </tr>
  );
});

// ---------------------------------------------------------------------------
// Record inspector schema. Each entry: key edited on the form, how it reads
// when not editing, and which input it becomes when editing.
// ---------------------------------------------------------------------------
const num = (v) => (v === '' || v == null ? null : Number(v));

const SECTIONS = [
  {
    title: 'Property',
    cols: 'grid-cols-2 sm:grid-cols-3',
    fields: [
      { key: 'community', label: 'Community' },
      { key: 'sub_community', label: 'Sub-community' },
      { key: 'building_cluster', label: 'Building / cluster', read: (r) => r.building_cluster || r.building },
      { key: 'unit_number', label: 'Unit', read: (r) => r.unit_number || r.unit, val: true },
      { key: 'bedroom', label: 'Bedroom', read: (r) => r.bedroom || r.bedroom_type },
      { key: 'size', label: 'Size', type: 'number', read: (r) => (r.size ? `${r.size} sq.ft` : null) },
      { key: 'property_type', label: 'Property type' },
      { key: 'developer', label: 'Developer' },
      { key: 'project', label: 'Project' },
    ],
  },
  {
    title: 'Contact',
    cols: 'grid-cols-2 sm:grid-cols-3',
    fields: [
      { key: 'name', label: 'Name', span: 2 },
      { key: 'party_type', label: 'Party type' },
      { key: 'mobile_1', label: 'Mobile 1', read: (r) => r.mobile_1 || r.mobile, num: true },
      { key: 'mobile_2', label: 'Mobile 2', num: true },
      { key: 'mobile_3', label: 'Mobile 3', num: true },
      { key: 'email_address', label: 'Email', type: 'email', span: 2 },
      { key: 'pi_number', label: 'PI number / ID', num: true },
      { key: 'nationality', label: 'Nationality' },
    ],
  },
  {
    title: 'Land registry',
    cols: 'grid-cols-2 sm:grid-cols-4',
    fields: [
      { key: 'plot_reg_no', label: 'Plot reg. no', val: true },
      { key: 'plot_number', label: 'Plot number', val: true },
      { key: 'dmno', label: 'DMNO', val: true },
      { key: 'dmsubno', label: 'DMSUBNO', val: true },
    ],
  },
];

function Field({ f, record, form, editing, onChange }) {
  const shown = f.read ? f.read(record) : record[f.key];
  const span = f.span === 2 ? 'col-span-2' : '';
  return (
    <div className={`min-w-0 ${span}`}>
      <div className="text-[11px] text-[var(--text-3)] mb-1">{f.label}</div>
      {editing ? (
        <input
          type={f.type || 'text'}
          value={form[f.key] ?? ''}
          onChange={(e) => onChange(f.key, f.type === 'number' ? num(e.target.value) : e.target.value)}
          aria-label={f.label}
          className={`field w-full h-8 px-2.5 text-[13px] ${f.val || f.num ? 'num' : ''}`}
        />
      ) : (
        <div className={`text-[13px] truncate ${f.val ? 'val' : f.num ? 'num text-[var(--text)]' : 'text-[var(--text)]'}`} title={shown || ''}>
          {shown || <span className="text-[var(--text-3)]">—</span>}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZES = [25, 50, 100];

export default function RecordsExplorer({ initialQuery = '' }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isExporting, setIsExporting] = useState(null); // 'csv' | 'xlsx' | null
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const activeRequestRef = useRef(0);
  const [community, setCommunity] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [bedroom, setBedroom] = useState('');
  const [status, setStatus] = useState('');
  const [sourceFile, setSourceFile] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  // The API stops counting at a ceiling rather than scanning every matching row
  // (see COUNT_CEILING in records.py), so a large result set reports a floor.
  // Render it as "20,000+" instead of quietly presenting a floor as an exact
  // total -- the honest number is what tells a user to narrow their filter.
  const [totalCapped, setTotalCapped] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ communities: [], property_types: [], bedroom_types: [], source_files: [], statuses: [] });
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Modal & Editing States
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const overlayRef = useRef(null);
  const searchRef = useRef(null);

  // The header search box feeds this page. Follow it while mounted, not only
  // on first render, so typing up top keeps working once you're already here.
  useEffect(() => {
    setSearch(initialQuery);
  }, [initialQuery]);

  // 300ms debounce for search query to eliminate keystroke request spam
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedRecord(null);
        setIsEditing(false);
      }
    };
    if (selectedRecord) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRecord]);

  // "/" focuses search from anywhere on the page, unless already typing.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || selectedRecord) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedRecord]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [debouncedSearch, community, propertyType, bedroom, status, sourceFile, sortBy, sortDir, page, limit]);

  const fetchFilterOptions = async () => {
    try {
      const res = await apiFetch('/api/records/filters');
      if (res.ok) {
        const data = await res.json();
        setFilterOptions((prev) => ({
          ...prev,
          communities: (data.communities || prev.communities).filter(
            (c) => c && !c.toLowerCase().includes('owner detail') && !c.toLowerCase().includes('total owner')
          ),
          property_types: data.property_types || prev.property_types,
          bedroom_types: data.bedrooms || data.bedroom_types || prev.bedroom_types,
          source_files: data.source_files || prev.source_files,
          statuses: data.statuses || ['VALID', 'DUPLICATE', 'ERROR'],
        }));
      }
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  const fetchRecords = async () => {
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
      if (sourceFile) params.append('source_file', sourceFile);
      if (page > 1 && totalRecords > 0) params.append('total_hint', totalRecords.toString());

      const res = await apiFetch(`/api/records?${params.toString()}`);
      if (currentReq !== activeRequestRef.current) {
        return; // newer request is in-flight; ignore stale response
      }
      if (res.ok) {
        const data = await res.json();
        const items = data.items || data.records || [];
        setRecords(items);
        setTotalPages(data.total_pages || 1);
        setTotalRecords(data.total || 0);
        setTotalCapped(Boolean(data.total_capped));

        if (data.filter_options) {
          setFilterOptions({
            communities: (data.filter_options.communities || []).filter(
              (c) => c && !c.toLowerCase().includes('owner detail') && !c.toLowerCase().includes('total owner')
            ),
            property_types: data.filter_options.property_types || [],
            bedroom_types: data.filter_options.bedrooms || data.filter_options.bedroom_types || [],
            source_files: data.filter_options.source_files || [],
            statuses: data.filter_options.statuses || ['VALID', 'DUPLICATE', 'ERROR'],
          });
        }
        setLoadError(null);
      } else {
        setLoadError(`The server answered ${res.status}.`);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      // A failed request is not an empty dataset. Saying "no records" here
      // would send an operator hunting for a filter that is not the problem.
      if (currentReq === activeRequestRef.current) {
        setLoadError('Could not reach the server.');
      }
    } finally {
      if (currentReq === activeRequestRef.current) {
        setLoading(false);
        setHasLoaded(true);
      }
    }
  };

  const handleHeaderSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const renderSortIndicator = (field) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[var(--accent)]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[var(--accent)]" />
    );
  };

  const openRecordModal = useCallback((record) => {
    setSelectedRecord(record);
    setEditForm({ ...record });
    setIsEditing(false);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const closeModal = () => {
    setSelectedRecord(null);
    setIsEditing(false);
  };

  const setField = (key, value) => setEditForm((f) => ({ ...f, [key]: value }));

  const handleSaveChanges = async () => {
    if (!selectedRecord) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await apiFetch(`/api/records/${selectedRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        const updatedRecord = await res.json();
        setSelectedRecord(updatedRecord);
        setEditForm({ ...updatedRecord });
        setIsEditing(false);
        setSaveSuccess(true);

        // Update local list
        setRecords((prev) => prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)));
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        const errData = await res.json();
        setSaveError(errData.detail || 'The record could not be saved.');
      }
    } catch (err) {
      console.error('Save error:', err);
      setSaveError('Network error. The record was not saved.');
    } finally {
      setIsSaving(false);
    }
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
      if (sourceFile) params.append('source_file', sourceFile);

      const res = await apiFetch(`/api/records/export?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Export failed. Please check your query or try again.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `datalink_records_export_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data: ' + err.message);
    } finally {
      setIsExporting(null);
    }
  };

  const clearAll = () => {
    setCommunity('');
    setPropertyType('');
    setBedroom('');
    setStatus('');
    setSearch('');
    setPage(1);
  };

  const STATUS_OPTIONS = [
    { label: 'Valid records', value: '' },
    { label: 'Duplicates only', value: 'DUPLICATE' },
    { label: 'Incomplete only', value: 'INCOMPLETE' },
    { label: 'Errors only', value: 'INVALID' },
    { label: 'Everything', value: 'ALL' },
  ];

  // Active filters as removable chips. Search is separate: it has its own clear.
  const activeFilters = [
    community && { label: community, clear: () => setCommunity('') },
    propertyType && { label: propertyType, clear: () => setPropertyType('') },
    bedroom && { label: bedroom, clear: () => setBedroom('') },
    status && { label: STATUS_OPTIONS.find((o) => o.value === status)?.label || status, clear: () => setStatus('') },
  ].filter(Boolean);
  const anyFilter = activeFilters.length > 0 || Boolean(search);

  const from = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalRecords);

  return (
    <div className="p-3 sm:p-5 h-full w-full max-w-[1500px] mx-auto flex flex-col min-h-0 overflow-hidden gap-3 sm:gap-4">
      {/* Page header */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--text)] tracking-tight leading-tight">Records</h2>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">
            <span className="num text-[var(--text)]">{formatTotal(totalRecords, totalCapped)}</span>
            {anyFilter ? ' matching records' : ' normalized records across all registers'}
            {totalCapped && <span className="text-[var(--text-3)]"> — narrow the filter for an exact count</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleExport('xlsx')}
            disabled={isExporting !== null}
            className="btn h-9 px-3 text-[13px]"
            title="Download the filtered records as an Excel workbook"
          >
            {isExporting === 'xlsx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-[var(--ok)]" />}
            <span>{isExporting === 'xlsx' ? 'Exporting' : 'Excel'}</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting !== null}
            className="btn h-9 px-3 text-[13px]"
            title="Download the filtered records as CSV"
          >
            {isExporting === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-[var(--text-3)]" />}
            <span>{isExporting === 'csv' ? 'Exporting' : 'CSV'}</span>
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex-shrink-0 panel p-2.5 sm:p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, community, unit or mobile"
              aria-label="Search records"
              className="field w-full h-9 pl-9 pr-16 text-[13px]"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
              {loading && search !== debouncedSearch && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-3)]" />}
              <kbd className="hidden sm:inline-block h-5 px-1.5 rounded border border-[var(--edge)] bg-[var(--surface)] text-[10px] text-[var(--text-3)] leading-5">/</kbd>
            </span>
          </div>

          {/* Mobile filter toggle (< lg) */}
          <button
            type="button"
            onClick={() => setShowMobileFilters((prev) => !prev)}
            aria-expanded={showMobileFilters}
            className={`lg:hidden btn h-9 px-3 text-[13px] shrink-0 ${activeFilters.length ? 'border-[var(--accent-ring)] text-[var(--accent)]' : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
            {activeFilters.length > 0 && (
              <span className="w-4.5 h-4.5 rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] text-[10px] flex items-center justify-center num">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>

        <div className={`${showMobileFilters ? 'grid' : 'hidden lg:grid'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2`}>
          <CustomSelect
            label="Community"
            value={community}
            onChange={(val) => { setCommunity(val); setPage(1); }}
            placeholder="All communities"
            options={[{ label: 'All communities', value: '' }, ...filterOptions.communities.map((c) => ({ label: c, value: c }))]}
          />
          <CustomSelect
            label="Property type"
            value={propertyType}
            onChange={(val) => { setPropertyType(val); setPage(1); }}
            placeholder="All property types"
            options={[
              { label: 'All property types', value: '' },
              { label: 'Residential', value: 'Residential' },
              { label: 'Commercial', value: 'Commercial' },
              { label: 'Land', value: 'Land' },
              ...(filterOptions.property_types || [])
                .filter((pt) => !['Residential', 'Commercial', 'Land', 'LAND'].includes(pt))
                .map((pt) => ({ label: pt, value: pt })),
            ]}
          />
          <CustomSelect
            label="Bedrooms"
            value={bedroom}
            onChange={(val) => { setBedroom(val); setPage(1); }}
            placeholder="All bedrooms"
            options={[
              { label: 'All bedrooms', value: '' },
              { label: 'Studio', value: 'Studio' },
              { label: '1 bedroom', value: '1 BR' },
              { label: '2 bedrooms', value: '2 BR' },
              { label: '3 bedrooms', value: '3 BR' },
              { label: '4 bedrooms', value: '4 BR' },
              { label: '5 bedrooms', value: '5 BR' },
              { label: '6+ bedrooms', value: '6 BR' },
              { label: 'Penthouse', value: 'PENTHOUSE' },
              { label: 'Retail / commercial', value: 'Retail' },
            ]}
          />
          <CustomSelect
            label="Status"
            value={status}
            onChange={(val) => { setStatus(val); setPage(1); }}
            placeholder="Valid records"
            options={STATUS_OPTIONS}
          />
        </div>

        {anyFilter && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 animate-fade-in">
            {search && (
              <span className="chip">
                <span className="text-[var(--text-3)]">search</span>
                <span className="truncate max-w-[200px]">“{search}”</span>
                <button onClick={() => setSearch('')} aria-label="Clear search" className="btn-ghost w-5 h-5 rounded-full text-[var(--accent)]">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeFilters.map((f) => (
              <span key={f.label} className="chip">
                <span className="truncate max-w-[200px]">{f.label}</span>
                <button onClick={() => { f.clear(); setPage(1); }} aria-label={`Remove filter ${f.label}`} className="btn-ghost w-5 h-5 rounded-full text-[var(--accent)]">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button onClick={clearAll} className="btn-ghost h-[30px] px-2.5 text-[12px]">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="panel overflow-hidden flex-1 flex flex-col min-h-0">
        <div className={`loading-bar ${loading ? '' : 'invisible'}`} aria-hidden="true" />
        <div className={`overflow-auto flex-1 min-h-0 transition-opacity duration-[var(--dur-2)] ${loading && hasLoaded ? 'opacity-60' : ''}`} aria-busy={loading}>
          <table className="data-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => {
                  const active = sortBy === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => handleHeaderSort(c.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleHeaderSort(c.key);
                        }
                      }}
                      tabIndex={0}
                      className={`group ${c.className || ''} ${active ? 'text-[var(--text)]' : ''}`}
                      title={`Sort by ${c.label.toLowerCase()}`}
                    >
                      <span className={`inline-flex items-center gap-1.5 ${c.align === 'right' ? 'flex-row-reverse' : ''}`}>
                        <span>{c.label}</span>
                        {renderSortIndicator(c.key)}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {!hasLoaded ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="pointer-events-none">
                    {COLUMNS.map((c) => (
                      <td key={c.key}>
                        <span className="block h-3 rounded bg-[var(--surface-3)]" style={{ width: `${45 + ((i * 17 + c.key.length * 9) % 45)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((r) => <RecordRow key={r.id} r={r} onSelect={openRecordModal} />)
              ) : loadError ? (
                <tr className="pointer-events-none">
                  <td colSpan={COLUMNS.length} className="py-16">
                    <div className="flex flex-col items-center text-center gap-2">
                      <span className="w-10 h-10 rounded-full bg-[var(--bad-soft)] border border-[var(--bad)]/30 flex items-center justify-center">
                        <AlertCircle className="w-4.5 h-4.5 text-[var(--bad)]" />
                      </span>
                      <div className="text-[13px] font-medium text-[var(--text)]">Records could not be loaded</div>
                      <div className="text-[12px] text-[var(--text-3)] max-w-xs">
                        {loadError} Your filters are still set — retry once the connection is back.
                      </div>
                      <button onClick={fetchRecords} className="btn h-8 px-3 text-[12px] mt-1 pointer-events-auto">
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr className="pointer-events-none">
                  <td colSpan={COLUMNS.length} className="py-16">
                    <div className="flex flex-col items-center text-center gap-2">
                      <span className="w-10 h-10 rounded-full bg-[var(--surface-2)] border border-[var(--edge)] flex items-center justify-center">
                        <SearchX className="w-4.5 h-4.5 text-[var(--text-3)]" />
                      </span>
                      <div className="text-[13px] font-medium text-[var(--text)]">No records match</div>
                      <div className="text-[12px] text-[var(--text-3)] max-w-xs">
                        {anyFilter ? 'Try a broader search, or remove a filter.' : 'Upload a register to start populating the dataset.'}
                      </div>
                      {anyFilter && (
                        <button onClick={clearAll} className="btn h-8 px-3 text-[12px] mt-1 pointer-events-auto">
                          Clear search and filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: legend + pagination */}
        <div className="shrink-0 px-3 py-2 border-t border-[var(--edge)] bg-[var(--surface-2)] flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px]">
          <div className="hidden md:flex items-center gap-3.5 text-[var(--text-3)]">
            {['VALID', 'DUPLICATE', 'INCOMPLETE', 'ERROR'].map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5" title={statusOf(s).hint}>
                <StatusDot status={s} />
                {statusOf(s).label}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-[var(--text-2)] num">
              {from.toLocaleString()}–{to.toLocaleString()} of {formatTotal(totalRecords, totalCapped)}
            </span>
            <label className="flex items-center gap-1.5 text-[var(--text-3)]">
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
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn h-7 w-7" aria-label="Previous page">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="num text-[var(--text-2)] px-1 whitespace-nowrap">
                {page} <span className="text-[var(--text-3)]">/ {totalPages}</span>
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn h-7 w-7" aria-label="Next page">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Record inspector */}
      {selectedRecord && (
        <div
          ref={overlayRef}
          onClick={(e) => {
            if (e.target === overlayRef.current) closeModal();
          }}
          className="fixed inset-0 z-50 bg-[var(--ink-2)]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6 animate-fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-title"
            className="glass-raised w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] rounded-b-none sm:rounded-b-[var(--r-xl)] flex flex-col overflow-hidden animate-rise-in"
          >
            {/* Header: identity + actions. Stays put while the body scrolls. */}
            <div className="shrink-0 px-5 pt-4 pb-3.5 border-b border-[var(--edge)] flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] text-[var(--text-3)] num">#{selectedRecord.id}</span>
                  <StatusBadge status={selectedRecord.status} />
                  {isEditing && <span className="badge badge-accent">Editing</span>}
                </div>
                <h3 id="record-title" className="text-base font-semibold text-[var(--text)] tracking-tight truncate">
                  {selectedRecord.name || selectedRecord.developer || 'Record'}
                </h3>
                <p className="text-[12px] text-[var(--text-2)] truncate mt-0.5">
                  {[selectedRecord.community, selectedRecord.building_cluster || selectedRecord.building].filter(Boolean).join(', ') || 'No location recorded'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} className="btn h-8 px-3 text-[13px]">
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setIsEditing(false); setEditForm({ ...selectedRecord }); }} className="btn-ghost h-8 px-3 text-[13px]">
                      Cancel
                    </button>
                    <button onClick={handleSaveChanges} disabled={isSaving} className="btn-primary h-8 px-3.5 text-[13px]">
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>Save changes</span>
                    </button>
                  </>
                )}
                <button onClick={closeModal} aria-label="Close" className="btn-ghost h-8 w-8 ml-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {(saveSuccess || saveError) && (
              <div
                role="status"
                className={`shrink-0 mx-5 mt-3 px-3 py-2 rounded-lg text-[12px] flex items-center gap-2 animate-drop-in ${
                  saveError
                    ? 'bg-[var(--bad-soft)] text-[var(--bad)] border border-[var(--bad)]/30'
                    : 'bg-[var(--ok-soft)] text-[var(--ok)] border border-[var(--ok)]/30'
                }`}
              >
                {saveError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{saveError || 'Changes saved.'}</span>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
              {/* The headline figure. Brass, because it's money. */}
              <div className="well px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] text-[var(--text-3)] mb-0.5">Procedure value</div>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editForm.procedure_value ?? ''}
                      onChange={(e) => setField('procedure_value', num(e.target.value))}
                      placeholder="e.g. 1050000"
                      aria-label="Procedure value in AED"
                      className="field h-9 px-3 text-[15px] val w-52"
                    />
                  ) : (
                    <div className="val text-xl font-medium">{formatAed(selectedRecord.procedure_value) || <span className="text-[var(--text-3)] text-base">Not recorded</span>}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-[var(--text-3)] mb-1">Status</div>
                  {isEditing ? (
                    <select
                      value={editForm.status || 'VALID'}
                      onChange={(e) => setField('status', e.target.value)}
                      aria-label="Status"
                      className="field h-8 pl-2.5 pr-2 text-[13px] cursor-pointer"
                    >
                      {['VALID', 'INCOMPLETE', 'DUPLICATE', 'ERROR'].map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                    </select>
                  ) : (
                    <StatusBadge status={selectedRecord.status} />
                  )}
                </div>
              </div>

              {SECTIONS.map((sec) => (
                <section key={sec.title} aria-label={sec.title}>
                  <h4 className="text-[12px] font-semibold text-[var(--text-2)] mb-2.5 pb-1.5 border-b border-[var(--edge)]">{sec.title}</h4>
                  <div className={`grid ${sec.cols} gap-x-4 gap-y-3`}>
                    {sec.fields.map((f) => (
                      <Field key={f.key} f={f} record={selectedRecord} form={editForm} editing={isEditing} onChange={setField} />
                    ))}
                  </div>
                </section>
              ))}

              {/* Outreach: log the call while looking at the person. */}
              <LeadActivityPanel recordId={selectedRecord.id} />
            </div>

            {/* Provenance. Every record traces back to a row in a file. */}
            <div className="shrink-0 px-5 py-2.5 border-t border-[var(--edge)] bg-[var(--surface-2)]/60 text-[11px] text-[var(--text-3)] flex items-center justify-between gap-3">
              <span className="truncate">
                Source: <span className="text-[var(--text-2)]">{selectedRecord.source_file}</span>
                <span className="num"> row {selectedRecord.source_row}</span>
              </span>
              <kbd className="hidden sm:inline-block h-5 px-1.5 rounded border border-[var(--edge)] bg-[var(--surface)] text-[10px] leading-5">Esc</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
