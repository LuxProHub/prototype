import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Play,
  Pause,
  Square,
  FileCode,
  Layers,
  Layers3,
  Plus,
  Trash2,
  FileSpreadsheet,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import Tilt3DCard from './Tilt3DCard';
import CustomSelect from './CustomSelect';
import { apiFetch } from '../lib/api';
import PageHeader from './ui/PageHeader';

export default function UploadSection({ onUploadComplete, activeJob }) {
  const [fileQueue, setFileQueue] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [batchSize, setBatchSize] = useState(500);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isInspectingQueue, setIsInspectingQueue] = useState(false);
  const [activeQueueIndex, setActiveQueueIndex] = useState(null);
  const [selectedFileForRemap, setSelectedFileForRemap] = useState(null);
  const [columnOverrides, setColumnOverrides] = useState({});
  const [targetFieldsList, setTargetFieldsList] = useState([]);
  const [globalError, setGlobalError] = useState(null);

  useEffect(() => {
    fetchMappingSchema();

    // Window-level drag listeners to enable dropping files from anywhere
    const onWindowDragOver = (e) => {
      e.preventDefault();
      setIsDragOver(true);
    };
    const onWindowDragLeave = (e) => {
      if (e.clientX === 0 || e.clientY === 0) {
        setIsDragOver(false);
      }
    };
    const onWindowDrop = (e) => {
      e.preventDefault();
      setIsDragOver(false);
    };

    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('dragleave', onWindowDragLeave);
    window.addEventListener('drop', onWindowDrop);

    return () => {
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('dragleave', onWindowDragLeave);
      window.removeEventListener('drop', onWindowDrop);
    };
  }, []);

  const fetchMappingSchema = async () => {
    try {
      const res = await apiFetch('/api/column-mappings');
      if (res.ok) {
        const data = await res.json();
        setTargetFieldsList(data.target_fields || []);
      }
    } catch (err) {
      console.error('Failed to fetch mapping schema:', err);
    }
  };

  const getFilesFromDataTransfer = async (dataTransfer) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const files = [];

    // Helper to read directory recursively when user drags a folder
    const readEntry = async (entry) => {
      if (!entry) return;
      if (entry.isFile) {
        const file = await new Promise((resolve) => entry.file(resolve));
        if (file) {
          const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
          if (validExtensions.includes(ext) && !file.name.startsWith('~$') && !file.name.startsWith('._')) {
            files.push(file);
          }
        }
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries = await new Promise((resolve) => {
          const allEntries = [];
          const readBatch = () => {
            dirReader.readEntries((results) => {
              if (!results || !results.length) {
                resolve(allEntries);
              } else {
                allEntries.push(...results);
                readBatch();
              }
            }, () => resolve(allEntries));
          };
          readBatch();
        });
        for (const child of entries) {
          await readEntry(child);
        }
      }
    };

    if (dataTransfer.items && dataTransfer.items.length > 0) {
      const items = Array.from(dataTransfer.items);
      for (const item of items) {
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            await readEntry(entry);
            continue;
          }
        }
        const file = item.getAsFile();
        if (file) {
          const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
          if (validExtensions.includes(ext) && !file.name.startsWith('~$') && !file.name.startsWith('._')) {
            files.push(file);
          }
        }
      }
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
      for (const file of Array.from(dataTransfer.files)) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (validExtensions.includes(ext) && !file.name.startsWith('~$') && !file.name.startsWith('._')) {
          files.push(file);
        }
      }
    }

    return files;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragOver(true);
    } else if (e.type === 'dragleave') {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = await getFilesFromDataTransfer(e.dataTransfer);
    if (files.length > 0) {
      addFilesToQueue(files);
    } else {
      setGlobalError('Please select or drop valid Excel (.xlsx, .xls) or CSV (.csv) files.');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
    }
  };

  const addFilesToQueue = (files) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const newItems = files
      .filter((f) => {
        const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
        return validExtensions.includes(ext) && !f.name.startsWith('~$') && !f.name.startsWith('._');
      })
      .map((f) => ({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        name: f.name,
        size: f.size,
        status: 'QUEUED',
        processedRows: 0,
        totalRows: 0,
        error: null,
        uploadResult: null,
      }));

    if (newItems.length === 0) {
      setGlobalError('Please select valid Excel (.xlsx, .xls) or CSV (.csv) files.');
      return;
    }

    setGlobalError(null);
    setFileQueue((prev) => [...prev, ...newItems]);
  };

  const removeFromQueue = (id) => {
    setFileQueue((prev) => prev.filter((item) => item.id !== id));
    if (selectedFileForRemap && selectedFileForRemap.id === id) {
      setSelectedFileForRemap(null);
    }
  };

  const clearQueue = () => {
    setFileQueue([]);
    setSelectedFileForRemap(null);
    setActiveQueueIndex(null);
  };

  const inspectSingleFile = async (item) => {
    const formData = new FormData();
    formData.append('file', item.file);

    const res = await apiFetch('/api/upload/inspect', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || `Failed to inspect file ${item.name}`);
    }

    const data = await res.json();
    return data;
  };

  const inspectQueueFile = async (item) => {
    setFileQueue((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, status: 'INSPECTING', error: null } : f))
    );

    try {
      const result = await inspectSingleFile(item);
      setFileQueue((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                status: 'INSPECTED',
                uploadResult: result,
                totalRows: result.total_rows_estimate || 0,
              }
            : f
        )
      );

      const initialMap = {};
      if (result.mapped_columns_preview) {
        result.mapped_columns_preview.forEach((c) => {
          initialMap[c.raw_header] = c.mapped_target || '';
        });
      }

      setSelectedFileForRemap({
        ...item,
        uploadResult: result,
      });
      setColumnOverrides(initialMap);
    } catch (err) {
      setFileQueue((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: 'FAILED', error: err.message } : f))
      );
    }
  };

  const inspectAllQueueFiles = async () => {
    if (isInspectingQueue || isProcessingQueue) return;
    setIsInspectingQueue(true);

    for (let i = 0; i < fileQueue.length; i++) {
      const item = fileQueue[i];
      if (item.status === 'QUEUED' || item.status === 'FAILED') {
        setActiveQueueIndex(i);
        await inspectQueueFile(item);
      }
    }

    setIsInspectingQueue(false);
    setActiveQueueIndex(null);
  };

  const processSingleFile = async (fileIndex) => {
    const queueItem = fileQueue[fileIndex];
    if (!queueItem) return;

    setActiveQueueIndex(fileIndex);
    setFileQueue((prev) =>
      prev.map((f, idx) => (idx === fileIndex ? { ...f, status: 'PROCESSING', error: null } : f))
    );

    try {
      const formData = new FormData();
      formData.append('file', queueItem.file);

      const uploadRes = await apiFetch(`/api/upload?batch_size=${batchSize}`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.detail || 'File upload failed');
      }

      const uploadData = await uploadRes.json();
      const jobId = uploadData.job_id;

      setFileQueue((prev) =>
        prev.map((f, idx) => (idx === fileIndex ? { ...f, jobId, status: 'PROCESSING', error: null } : f))
      );

      if (Object.keys(columnOverrides).length > 0 && selectedFileForRemap?.id === queueItem.id) {
        await apiFetch(`/api/jobs/${jobId}/mapping-overrides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overrides: columnOverrides }),
        });
      }

      const startRes = await apiFetch(`/api/jobs/${jobId}/start`, { method: 'POST' });
      if (!startRes.ok) {
        const errData = await startRes.json();
        throw new Error(errData.detail || 'Failed to start processing job');
      }

      let isFinished = false;
      while (!isFinished) {
        await new Promise((r) => setTimeout(r, 1000));
        const statusRes = await apiFetch(`/api/jobs/${jobId}`);
        if (statusRes.ok) {
          const sData = await statusRes.json();
          setFileQueue((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex
                ? {
                    ...f,
                    jobId: jobId,
                    processedRows: sData.processed_rows || 0,
                    totalRows: sData.total_rows || f.totalRows,
                    progressPercent: sData.progress_percent || 0,
                    currentSheet: sData.current_sheet || '',
                    status: sData.status === 'PAUSED' ? 'PAUSED' : sData.status || f.status,
                  }
                : f
            )
          );

          if (sData.status === 'COMPLETED' || sData.status === 'COMPLETED_WITH_ERRORS') {
            isFinished = true;
            setFileQueue((prev) =>
              prev.map((f, idx) =>
                idx === fileIndex ? { ...f, status: 'COMPLETED', jobResult: sData } : f
              )
            );
            if (onUploadComplete) onUploadComplete(jobId);
          } else if (sData.status === 'CANCELLED') {
            isFinished = true;
            setFileQueue((prev) =>
              prev.map((f, idx) =>
                idx === fileIndex
                  ? { ...f, status: 'CANCELLED', error: 'Job stopped by user' }
                  : f
              )
            );
          } else if (sData.status === 'FAILED') {
            isFinished = true;
            setFileQueue((prev) =>
              prev.map((f, idx) =>
                idx === fileIndex
                  ? { ...f, status: 'FAILED', error: sData.message || sData.error_message || 'Processing failed' }
                  : f
              )
            );
          }
        }
      }
    } catch (err) {
      console.error(`Error processing file ${queueItem.name}:`, err);
      setFileQueue((prev) =>
        prev.map((f, idx) =>
          idx === fileIndex ? { ...f, status: 'FAILED', error: err.message } : f
        )
      );
    } finally {
      setActiveQueueIndex(null);
    }
  };

  const handlePauseJob = async (jobId) => {
    if (!jobId) return;
    try {
      await apiFetch(`/api/jobs/${jobId}/pause`, { method: 'POST' });
      setFileQueue((prev) =>
        prev.map((f) => (f.jobId === jobId ? { ...f, status: 'PAUSED' } : f))
      );
    } catch (err) {
      console.error('Failed to pause job:', err);
    }
  };

  const handleResumeJob = async (jobId) => {
    if (!jobId) return;
    try {
      await apiFetch(`/api/jobs/${jobId}/resume`, { method: 'POST' });
      setFileQueue((prev) =>
        prev.map((f) => (f.jobId === jobId ? { ...f, status: 'PROCESSING' } : f))
      );
    } catch (err) {
      console.error('Failed to resume job:', err);
    }
  };

  const handleCancelJob = async (jobId) => {
    if (!jobId) return;
    try {
      await apiFetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
      setFileQueue((prev) =>
        prev.map((f) => (f.jobId === jobId ? { ...f, status: 'CANCELLED', error: 'Job stopped by user' } : f))
      );
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  const startBatchQueueProcessing = async () => {
    if (isProcessingQueue || fileQueue.length === 0) return;
    setIsProcessingQueue(true);

    for (let i = 0; i < fileQueue.length; i++) {
      if (fileQueue[i].status !== 'COMPLETED') {
        await processSingleFile(i);
      }
    }

    setIsProcessingQueue(false);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Title Header */}
      <PageHeader
        title="Upload registers"
        description="Drop in one or more registers, check how their headers map, then run the batch."
        actions={
          fileQueue.length > 0 && (
            <>
              <button
                onClick={clearQueue}
                disabled={isProcessingQueue || isInspectingQueue}
                className="btn px-3.5 py-2 text-[var(--text-2)] font-semibold text-xs"
              >
                Clear Queue
              </button>

              <button
                onClick={inspectAllQueueFiles}
                disabled={
                  isInspectingQueue ||
                  isProcessingQueue ||
                  !fileQueue.some((f) => f.status === 'QUEUED' || f.status === 'FAILED')
                }
                className="btn px-4 py-2 text-[var(--accent)] font-semibold text-xs flex items-center space-x-2"
              >
                {isInspectingQueue ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                    <span>Inspecting Files...</span>
                  </>
                ) : (
                  <>
                    <FileCode className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Inspect All ({fileQueue.filter((f) => f.status === 'QUEUED').length})</span>
                  </>
                )}
              </button>

              <button
                onClick={startBatchQueueProcessing}
                disabled={isProcessingQueue || isInspectingQueue || fileQueue.every((f) => f.status === 'COMPLETED')}
                className="btn-primary px-5 py-2 text-xs font-semibold flex items-center space-x-2"
              >
                {isProcessingQueue ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Running Batch Queue...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Run All ({fileQueue.filter((f) => f.status !== 'COMPLETED').length} Files)</span>
                  </>
                )}
              </button>
            </>
          )
        }
      />

      {/* Drag & Drop Multi-File Zone */}
      <Tilt3DCard className="p-5 sm:p-8 text-center border border-[var(--edge)]">
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className="space-y-3 sm:space-y-4"
        >
          <input
            type="file"
            id="file-upload-multi"
            accept=".xlsx,.xls,.csv"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-lg sm:rounded-xl bg-[var(--surface)] border border-[var(--accent-ring)] flex items-center justify-center text-[var(--accent)] field ">
            <Layers3 className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>

          <div className="space-y-2">
            <p className="text-base sm:text-lg font-semibold text-[var(--text)] tracking-tight">
              Tap to choose files or drop Excel / CSV files here
            </p>
            <p className="text-xs text-[var(--text-3)] font-mono max-w-md mx-auto">
              Select 1 or 20+ registers simultaneously (.xlsx, .xls, .csv). Batch engine processes files sequentially.
            </p>
            <label
              htmlFor="file-upload-multi"
              className="btn-primary inline-flex items-center space-x-2 px-5 sm:px-6 py-2.5 sm:py-3 text-xs font-semibold cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Select Multiple Files</span>
            </label>
          </div>
        </div>
      </Tilt3DCard>

      {globalError && (
        <div className="p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--bad)]/30 text-[var(--bad)] text-xs font-mono font-semibold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-[var(--bad)] flex-shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Multi-File Batch Queue List */}
      {fileQueue.length > 0 && (
        <Tilt3DCard className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--edge)] pb-3">
            <div className="flex items-center space-x-2 font-mono text-xs font-semibold text-[var(--text)]">
              <Layers className="w-4 h-4 text-[var(--accent)]" />
              <span>INGESTION QUEUE PIPELINE ({fileQueue.length} FILES)</span>
            </div>

            {/* Batch Size Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-[var(--text-2)] font-medium">Batch Size:</span>
              <CustomSelect
                value={batchSize}
                onChange={(val) => setBatchSize(Number(val))}
                options={[
                  { label: '250 rows / batch', value: 250 },
                  { label: '500 rows / batch', value: 500 },
                  { label: '1000 rows / batch', value: 1000 },
                ]}
              />
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {fileQueue.map((item, idx) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border transition-all flex flex-col gap-3 text-xs font-mono ${
                  activeQueueIndex === idx || item.status === 'PROCESSING'
                    ? 'bg-[var(--surface-2)] border-[var(--accent-ring)]'
                    : item.status === 'PAUSED'
                    ? 'bg-[var(--surface-2)] border-[var(--warn)]/30'
                    : item.status === 'COMPLETED'
                    ? 'bg-[var(--surface-2)] border-[var(--ok)]/30'
                    : item.status === 'FAILED' || item.status === 'CANCELLED'
                    ? 'bg-[var(--surface-2)] border-[var(--bad)]/30'
                    : 'bg-[var(--surface-2)] border-[var(--edge)]'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[var(--surface-2)] border border-[var(--edge)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <p className="font-semibold text-[var(--text)] truncate max-w-xs sm:max-w-md">{item.name}</p>
                        {item.name.toLowerCase().includes('consolidated') && (
                          <span className="px-2 py-0.5 rounded-md bg-[var(--warn-soft)] text-[var(--warn)] text-[10px] font-semibold border border-[var(--warn)]/30">
                            Pre-Consolidated File
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--text-3)]">
                        {(item.size / 1024).toFixed(1)} KB | Status: <span className="text-[var(--text)] font-semibold">{item.status}</span>
                        {item.totalRows > 0 && ` | ${item.totalRows.toLocaleString()} rows`}
                      </p>
                    </div>
                  </div>

                  {/* Status Badges & Controls */}
                  <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center">
                    {item.status === 'QUEUED' && (
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-2)] text-[10px] font-semibold border border-[var(--edge)]">
                        QUEUED
                      </span>
                    )}

                    {item.status === 'INSPECTING' && (
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--accent)] text-[10px] font-semibold border border-[var(--accent-ring)] flex items-center space-x-1">
                        <RefreshCw className="w-3 h-3 animate-spin text-[var(--accent)]" />
                        <span>INSPECTING</span>
                      </span>
                    )}

                    {item.status === 'INSPECTED' && (
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--accent)] text-[10px] font-semibold border border-[var(--accent-ring)] flex items-center space-x-1">
                        <FileCode className="w-3 h-3 text-[var(--accent)]" />
                        <span>INSPECTED ({item.uploadResult?.mapped_target_count || 0} mapped)</span>
                      </span>
                    )}

                    {item.status === 'PROCESSING' && (
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--ok)] text-[10px] font-semibold border border-[var(--ok)]/30 flex items-center space-x-1">
                        <RefreshCw className="w-3 h-3 animate-spin text-[var(--ok)]" />
                        <span>PROCESSING</span>
                      </span>
                    )}

                    {item.status === 'PAUSED' && (
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--warn)] text-[10px] font-semibold border border-[var(--warn)]/30 flex items-center space-x-1">
                        <Pause className="w-3 h-3 text-[var(--warn)]" />
                        <span>PAUSED</span>
                      </span>
                    )}

                    {item.status === 'COMPLETED' && (
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--ok)] text-[10px] font-semibold border border-[var(--ok)]/30 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ok)]" />
                        <span>INGESTED ({item.processedRows || item.totalRows} rows)</span>
                      </span>
                    )}

                    {item.status === 'CANCELLED' && (
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-2)] text-[10px] font-semibold border border-[var(--edge)] flex items-center space-x-1">
                        <Square className="w-3 h-3 text-[var(--text-3)]" />
                        <span>CANCELLED</span>
                      </span>
                    )}

                    {item.status === 'FAILED' && (
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--bad)] text-[10px] font-semibold border border-[var(--bad)]/30 flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 text-[var(--bad)]" />
                        <span>FAILED</span>
                      </span>
                    )}

                    {/* Pause / Resume / Stop Controls for Active Job */}
                    {(item.status === 'PROCESSING' || item.status === 'PAUSED') && item.jobId && (
                      <div className="flex items-center space-x-1.5 ml-1">
                        {item.status === 'PROCESSING' ? (
                          <button
                            onClick={() => handlePauseJob(item.jobId)}
                            className="btn px-2.5 py-1 text-[var(--warn)] text-[10px] font-semibold flex items-center space-x-1 hover:text-[var(--warn)] "
                            title="Pause processing at batch boundary"
                          >
                            <Pause className="w-3 h-3 text-[var(--warn)]" />
                            <span>Pause</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResumeJob(item.jobId)}
                            className="btn-primary px-2.5 py-1 text-[10px] font-semibold flex items-center space-x-1 "
                            title="Resume processing"
                          >
                            <Play className="w-3 h-3 fill-white text-white" />
                            <span>Resume</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleCancelJob(item.jobId)}
                          className="btn px-2.5 py-1 text-[var(--bad)] text-[10px] font-semibold flex items-center space-x-1 hover:text-[var(--bad)] "
                          title="Stop / Cancel processing"
                        >
                          <Square className="w-3 h-3 text-[var(--bad)] fill-rose-600" />
                          <span>Stop</span>
                        </button>
                      </div>
                    )}

                    {/* Actions per file */}
                    {item.status !== 'COMPLETED' && item.status !== 'PROCESSING' && item.status !== 'PAUSED' && (
                      <>
                        <button
                          onClick={() => inspectQueueFile(item)}
                          className="btn px-2.5 py-1 text-[var(--accent)] text-[10px] font-semibold flex items-center space-x-1"
                          title="Inspect Column Headers"
                        >
                          <FileCode className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                        <button
                          onClick={() => processSingleFile(idx)}
                          className="btn-primary px-2.5 py-1 text-[10px] font-semibold flex items-center space-x-1"
                          title="Process File Now"
                        >
                          <Play className="w-3 h-3 fill-white text-white" />
                          <span>Run</span>
                        </button>
                      </>
                    )}

                    {item.status !== 'PROCESSING' && item.status !== 'PAUSED' && (
                      <button
                        onClick={() => removeFromQueue(item.id)}
                        disabled={isProcessingQueue}
                        className="btn p-1.5 text-[var(--text-3)] hover:text-[var(--bad)]"
                        title="Remove from Queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Real-Time Live Progress Bar */}
                {(item.status === 'PROCESSING' || item.status === 'PAUSED' || (item.status === 'COMPLETED' && item.processedRows > 0)) && (
                  <div className="w-full mt-1 pt-2 border-t border-[var(--edge)] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="flex items-center space-x-1.5 font-semibold">
                        {item.status === 'PROCESSING' && (
                          <span className="flex items-center space-x-1 text-[var(--ok)]">
                            <RefreshCw className="w-3 h-3 animate-spin text-[var(--ok)]" />
                            <span>Streaming rows ({item.currentSheet || 'Sheet 1'})...</span>
                          </span>
                        )}
                        {item.status === 'PAUSED' && (
                          <span className="text-[var(--warn)] font-semibold flex items-center space-x-1">
                            <Pause className="w-3 h-3 text-[var(--warn)]" />
                            <span>Paused at batch boundary</span>
                          </span>
                        )}
                        {item.status === 'COMPLETED' && (
                          <span className="text-[var(--ok)] font-semibold flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-[var(--ok)]" />
                            <span>Processing complete</span>
                          </span>
                        )}
                      </span>

                      <span className="font-semibold text-[var(--text)]">
                        {(item.processedRows || 0).toLocaleString()} / {(item.totalRows || 0).toLocaleString()} rows (
                        {item.status === 'COMPLETED'
                          ? 100
                          : item.totalRows > 0
                          ? Math.min(99, Math.round(((item.processedRows || 0) / item.totalRows) * 100))
                          : Math.round(item.progressPercent || 0)}
                        %)
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="w-full h-2.5 rounded-full bg-[var(--surface-3)] overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.status === 'PAUSED'
                            ? 'bg-[var(--warn)]'
                            : item.status === 'COMPLETED'
                            ? 'bg-[var(--ok)]'
                            : 'bg-[var(--accent)]'
                        }`}
                        style={{
                          width: `${
                            item.status === 'COMPLETED'
                              ? 100
                              : item.totalRows > 0
                              ? Math.max(4, Math.min(99, Math.round(((item.processedRows || 0) / item.totalRows) * 100)))
                              : Math.max(4, Math.min(99, item.progressPercent || 5))
                          }%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Tilt3DCard>
      )}

      {/* Column Remapping Studio for Inspected File */}
      {selectedFileForRemap && selectedFileForRemap.uploadResult && (
        <Tilt3DCard className="p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-[var(--edge)] pb-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  Header Remapping Studio: {selectedFileForRemap.name}
                </h3>
                <p className="text-xs text-[var(--text-2)] font-medium">Verify or override target field mappings before running.</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedFileForRemap(null)}
              className="btn px-3 py-1.5 text-xs text-[var(--text-2)] font-semibold"
            >
              Close Studio
            </button>
          </div>

          {selectedFileForRemap.uploadResult.mapped_columns_preview && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-mono font-semibold text-[var(--text-2)]">
                <span>DETECTED RAW COLUMNS ({selectedFileForRemap.uploadResult.header_count})</span>
                <span className="text-[var(--accent)]">
                  {selectedFileForRemap.uploadResult.mapped_count} / {selectedFileForRemap.uploadResult.header_count} Mapped
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-lg border border-[var(--edge)] bg-[var(--surface-2)] p-2 space-y-2">
                {selectedFileForRemap.uploadResult.mapped_columns_preview.map((colItem, idx) => {
                  const currentMappedField = columnOverrides[colItem.raw_header] || '';
                  return (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-3 text-xs font-mono bg-[var(--surface-2)] rounded-xl border border-[var(--edge)]">
                      <div className="flex items-center space-x-2 font-semibold text-[var(--text)] max-w-[200px] truncate">
                        <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span title={colItem.raw_header}>{colItem.raw_header}</span>
                      </div>

                      <ArrowRight className="w-4 h-4 text-[var(--text-3)] flex-shrink-0" />

                      <CustomSelect
                        value={currentMappedField}
                        onChange={(val) => {
                          setColumnOverrides((prev) => ({
                            ...prev,
                            [colItem.raw_header]: val,
                          }));
                        }}
                        placeholder="-- Unmapped / Ignore --"
                        options={[
                          { label: '-- Unmapped / Ignore --', value: '' },
                          ...targetFieldsList.map((tf) => ({ label: tf, value: tf }))
                        ]}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Tilt3DCard>
      )}
    </div>
  );
}
