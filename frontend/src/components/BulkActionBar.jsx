import React from 'react';
import { UserPlus, FileSpreadsheet, FileText, X, CheckSquare } from 'lucide-react';

/**
 * Floating Liquid Glass Contextual Bulk Action Bar
 * Appears dynamically when 1+ records are selected in Records table.
 */
export default function BulkActionBar({
  selectedCount,
  onAddToQueue,
  onExportCsv,
  onExportXlsx,
  onClear,
  isExporting = false,
  className = '',
}) {
  if (!selectedCount) return null;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions for selected records"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-rise-in pointer-events-auto ${className}`}
    >
      <div className="glass-liquid px-4 py-2.5 rounded-[var(--r-xl)] shadow-2xl border border-[var(--edge-strong)] flex items-center gap-3 text-[13px]">
        <div className="flex items-center gap-2 pr-2 border-r border-[var(--edge)]">
          <CheckSquare className="w-4 h-4 text-[var(--accent)]" />
          <span className="font-bold num text-[var(--text)]">
            {selectedCount.toLocaleString()}
          </span>
          <span className="text-[var(--text-2)] hidden sm:inline">
            selected
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onAddToQueue}
            className="btn-primary h-8 px-3 text-[12.5px] flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add to Queue</span>
          </button>

          <button
            onClick={onExportCsv}
            disabled={isExporting}
            className="btn h-8 px-2.5 text-[12px] flex items-center gap-1"
            title="Export selected to CSV"
          >
            <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={onExportXlsx}
            disabled={isExporting}
            className="btn h-8 px-2.5 text-[12px] flex items-center gap-1"
            title="Export selected to Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--ok)]" />
            <span className="hidden sm:inline">XLSX</span>
          </button>
        </div>

        <div className="pl-1 border-l border-[var(--edge)]">
          <button
            onClick={onClear}
            aria-label="Clear selection"
            title="Clear selection"
            className="btn-ghost h-7 w-7 rounded-[var(--r-sm)] hover:text-[var(--bad)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
