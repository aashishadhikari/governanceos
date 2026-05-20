'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Header from '@/components/layout/Header';
import { getFlagEmoji } from '@/lib/utils';
import {
  Upload, RefreshCw, Plus, Pencil, Trash2, X, ChevronDown,
  ChevronRight, Calendar, AlertTriangle, CheckCircle2, Clock3,
  Globe, Filter, Download,
} from 'lucide-react';
import { FormField, Input, Select, Button } from '@/components/ui/FormField';
import Modal from '@/components/ui/Modal';
import type { Entity } from '@/lib/db/schema';

// ── Types ────────────────────────────────────────────────────────────────────

interface CalendarRow {
  id: string;
  entityId: string;
  entityName: string;
  entityCountry: string;
  requirementType: string;
  regulator: string;
  description: string;
  dueDate: string;
  status: string;
  owner: string;
  notes: string | null;
  recurrence: string;
  source: string;
  calendarYear: number | null;
}

interface GroupedJurisdiction {
  country: string;
  entityName: string;
  rows: CalendarRow[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i);

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:        { label: 'Pending',   color: 'bg-amber-100 text-amber-700' },
  submitted:      { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  overdue:        { label: 'Overdue',   color: 'bg-red-100 text-red-700' },
  completed:      { label: 'Completed', color: 'bg-green-100 text-green-700' },
  not_applicable: { label: 'N/A',       color: 'bg-gray-100 text-gray-600' },
};

const RECURRENCES = [
  { value: 'annual', label: 'Annual' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'none', label: 'One-off' },
];

const STATUSES = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));

// ── Urgency helpers ──────────────────────────────────────────────────────────

function daysUntil(d: string | Date) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dt = new Date(d); dt.setHours(0, 0, 0, 0);
  return Math.ceil((dt.getTime() - now.getTime()) / 86_400_000);
}

function UrgencyDot({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === 'completed' || status === 'not_applicable') {
    return <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" title="Completed" />;
  }
  const d = daysUntil(dueDate);
  if (d < 0)   return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" title="Overdue" />;
  if (d <= 30)  return <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" title={`${d} days`} />;
  if (d <= 60)  return <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" title={`${d} days`} />;
  if (d <= 90)  return <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" title={`${d} days`} />;
  return <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" title={`${d} days`} />;
}

function UrgencyBadge({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === 'completed' || status === 'not_applicable') return null;
  const d = daysUntil(dueDate);
  if (d < 0)   return <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Overdue</span>;
  if (d <= 30)  return <span className="text-xs font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{d}d</span>;
  if (d <= 60)  return <span className="text-xs font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">{d}d</span>;
  if (d <= 90)  return <span className="text-xs font-medium text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded">{d}d</span>;
  return null;
}

function formatDue(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function parseDri(notes: string | null) {
  if (!notes) return { compliance: '', finance: '' };
  return {
    compliance: notes.match(/Compliance DRI:\s*([^|]+)/i)?.[1]?.trim() ?? '',
    finance:    notes.match(/Finance DRI:\s*([^|]+)/i)?.[1]?.trim() ?? '',
  };
}

// ── Excel parser (client-side) ───────────────────────────────────────────────

// Parses Matt's regulatory calendar Excel using xlsx (SheetJS)
async function parseCalendarExcel(file: File): Promise<{ year: number; entries: Record<string, string>[] }> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });

  // Find the sheet — try "2026 Calendar" or first sheet
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('calendar')) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Try to extract year from sheet name
  const yearMatch = sheetName.match(/\d{4}/);
  const year = yearMatch ? Number(yearMatch[0]) : CURRENT_YEAR;

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: '' });

  // Normalise headers — the Excel may use different casing/spacing
  const entries = raw.map((row: Record<string, unknown>) => {
    const r: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) r[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim();
    return r;
  }).filter(r => r.entity_name || r.entity || r['entity name']);

  return { year, entries };
}

// ── Blank form ────────────────────────────────────────────────────────────────

const BLANK: Omit<CalendarRow, 'id' | 'entityName' | 'entityCountry' | 'source' | 'calendarYear'> = {
  entityId: '', requirementType: '', regulator: '', description: '',
  dueDate: '', status: 'pending', owner: 'Compliance', notes: '', recurrence: 'annual',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function RegulatoryCalendarClient({ entities }: { entities: Entity[] }) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ ...BLANK });
  const [addSaving, setAddSaving] = useState(false);
  const [editRow, setEditRow] = useState<CalendarRow | null>(null);
  const [editForm, setEditForm] = useState({ ...BLANK });
  const [editSaving, setEditSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const load = useCallback(async (yr: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/compliance/calendar?year=${yr}`);
      const json = await res.json();
      setRows(json.data ?? []);
      // Expand all groups by default
      const countries = new Set<string>((json.data ?? []).map((r: CalendarRow) => r.entityCountry));
      setExpanded(countries);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  // ── Group by entity/country ────────────────────────────────────────────────

  const grouped: GroupedJurisdiction[] = (() => {
    const map = new Map<string, GroupedJurisdiction>();
    for (const r of rows) {
      const key = r.entityId;
      if (!map.has(key)) {
        map.set(key, { country: r.entityCountry, entityName: r.entityName, rows: [] });
      }
      map.get(key)!.rows.push(r);
    }
    // Filter
    const all = Array.from(map.values());
    return filterCountry
      ? all.filter(g => g.country.toLowerCase().includes(filterCountry.toLowerCase()) || g.entityName.toLowerCase().includes(filterCountry.toLowerCase()))
      : all;
  })();

  const countries = [...new Set(rows.map(r => r.entityCountry))].sort();

  // ── Legend counts ──────────────────────────────────────────────────────────

  const stats = {
    total: rows.length,
    overdue: rows.filter(r => r.status !== 'completed' && r.status !== 'not_applicable' && daysUntil(r.dueDate) < 0).length,
    due30: rows.filter(r => r.status !== 'completed' && r.status !== 'not_applicable' && daysUntil(r.dueDate) >= 0 && daysUntil(r.dueDate) <= 30).length,
    due60: rows.filter(r => r.status !== 'completed' && r.status !== 'not_applicable' && daysUntil(r.dueDate) > 30 && daysUntil(r.dueDate) <= 60).length,
    due90: rows.filter(r => r.status !== 'completed' && r.status !== 'not_applicable' && daysUntil(r.dueDate) > 60 && daysUntil(r.dueDate) <= 90).length,
    completed: rows.filter(r => r.status === 'completed').length,
  };

  // ── Excel import ───────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const { year: fileYear, entries } = await parseCalendarExcel(file);

      // Normalise entries to our CalendarEntry shape
      const normalised = entries.map(r => ({
        entity_name: r.entity_name || r.entity || r['entity name'] || '',
        regulator: r.regulator || r.regulatory_body || '',
        report_name: r.report_name || r.report || r.filing_name || r.requirement || '',
        frequency: r.frequency || '',
        deadline_raw: r.deadline || r.deadline_date || '',
        due_date: r.due_date || r.deadline || '',
        recurrence: r.recurrence || r.frequency?.toLowerCase().includes('quarter') ? 'quarterly' : 'annual',
        lead_team: r.lead_team || r.team || 'Compliance',
        compliance_dri: r.compliance_dri || r.compliance_owner || '',
        finance_dri: r.finance_dri || r.finance_owner || '',
      })).filter(e => e.entity_name && e.report_name);

      const res = await fetch('/api/compliance/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: fileYear, entries: normalised }),
      });
      const json = await res.json();

      setImportResult(`Imported ${fileYear}: ${json.created} created, ${json.updated} updated, ${json.skipped} skipped`);
      setYear(fileYear);
      await load(fileYear);
    } catch (err) {
      setImportResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // ── Status update ──────────────────────────────────────────────────────────

  const updateStatus = async (rowId: string, status: string) => {
    await fetch(`/api/compliance/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, status } : r));
  };

  // ── Add row ────────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSaving(true);
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          dueDate: addForm.dueDate,
          source: 'manual',
          calendarYear: year,
        }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || 'Failed to add'); return; }
      await load(year);
      setAddOpen(false);
      setAddForm({ ...BLANK });
    } catch (err) {
      alert(String(err));
    } finally {
      setAddSaving(false);
    }
  };

  // ── Edit row ───────────────────────────────────────────────────────────────

  const openEdit = (row: CalendarRow) => {
    setEditRow(row);
    setEditForm({
      entityId: row.entityId,
      requirementType: row.requirementType,
      regulator: row.regulator,
      description: row.description,
      dueDate: row.dueDate ? new Date(row.dueDate).toISOString().slice(0, 10) : '',
      status: row.status,
      owner: row.owner,
      notes: row.notes ?? '',
      recurrence: row.recurrence,
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRow) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/compliance/${editRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || 'Failed to update'); return; }
      await load(year);
      setEditRow(null);
    } catch (err) {
      alert(String(err));
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete row ─────────────────────────────────────────────────────────────

  const handleDelete = async (row: CalendarRow) => {
    if (!confirm(`Delete "${row.requirementType}" for ${row.entityName}?`)) return;
    await fetch(`/api/compliance/${row.id}`, { method: 'DELETE' });
    setRows(prev => prev.filter(r => r.id !== row.id));
  };

  // ── Toggle expand ──────────────────────────────────────────────────────────

  const toggle = (key: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <Header
        title="Regulatory Calendar"
        subtitle={`${rows.length} filing obligations · ${year}`}
      />

      <div className="px-8 py-6 space-y-5">

        {/* ── Controls ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="text-sm font-medium text-gray-700 bg-transparent border-none outline-none pr-1"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Country filter */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterCountry}
              onChange={e => setFilterCountry(e.target.value)}
              className="text-sm text-gray-700 bg-transparent border-none outline-none"
            >
              <option value="">All jurisdictions</option>
              {countries.map(c => <option key={c} value={c}>{getFlagEmoji(c)} {c}</option>)}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { setAddOpen(true); setAddForm({ ...BLANK }); }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Entry
            </button>
            <label className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
              {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import Excel
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        {/* Import result message */}
        {importResult && (
          <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border ${importResult.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            {importResult.startsWith('Error') ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {importResult}
            <button onClick={() => setImportResult(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'bg-indigo-500', dot: '' },
            { label: 'Overdue', value: stats.overdue, color: 'bg-red-500', dot: 'bg-red-500' },
            { label: 'Due ≤30d', value: stats.due30, color: 'bg-red-400', dot: 'bg-red-400' },
            { label: 'Due ≤60d', value: stats.due60, color: 'bg-orange-400', dot: 'bg-orange-400' },
            { label: 'Due ≤90d', value: stats.due90, color: 'bg-yellow-400', dot: 'bg-yellow-400' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                {s.value}
              </div>
              <p className="text-sm font-medium text-gray-700">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Dot legend ── */}
        <div className="flex items-center gap-5 text-xs text-gray-500">
          <span className="font-medium text-gray-700">Urgency markers:</span>
          {[
            { color: 'bg-red-500 animate-pulse', label: 'Overdue' },
            { color: 'bg-red-400', label: '≤30 days' },
            { color: 'bg-orange-400', label: '≤60 days' },
            { color: 'bg-yellow-400', label: '≤90 days' },
            { color: 'bg-gray-300', label: '>90 days' },
            { color: 'bg-green-400', label: 'Completed' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${l.color} inline-block`} />
              {l.label}
            </div>
          ))}
        </div>

        {/* ── Grouped rows ── */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16">
            <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No entries for {year}</p>
            <p className="text-sm text-gray-400 mt-1">Import an Excel file or add entries manually.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(({ country, entityName, rows: grpRows }) => {
              const key = entityName;
              const isOpen = expanded.has(key);
              const urgentCount = grpRows.filter(r => r.status !== 'completed' && r.status !== 'not_applicable' && daysUntil(r.dueDate) <= 90 && daysUntil(r.dueDate) >= 0).length;
              const overdueCount = grpRows.filter(r => r.status !== 'completed' && daysUntil(r.dueDate) < 0).length;

              return (
                <div key={key} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => toggle(key)}
                    className="w-full flex items-center gap-3 px-6 py-4 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors text-left"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                    <span className="text-xl leading-none">{getFlagEmoji(country)}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{entityName}</p>
                      <p className="text-xs text-gray-500">{country} · {grpRows.length} filings</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {overdueCount > 0 && (
                        <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{overdueCount} overdue</span>
                      )}
                      {urgentCount > 0 && (
                        <span className="text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{urgentCount} urgent</span>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-50">
                            <th className="text-left px-6 py-2.5 font-medium w-6"></th>
                            <th className="text-left px-3 py-2.5 font-medium">Filing / Requirement</th>
                            <th className="text-left px-3 py-2.5 font-medium">Regulator</th>
                            <th className="text-left px-3 py-2.5 font-medium">Due Date</th>
                            <th className="text-left px-3 py-2.5 font-medium">Recurrence</th>
                            <th className="text-left px-3 py-2.5 font-medium">DRI</th>
                            <th className="text-left px-3 py-2.5 font-medium">Status</th>
                            <th className="px-3 py-2.5 w-20"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {grpRows.map(row => {
                            const dri = parseDri(row.notes);
                            return (
                              <tr key={row.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-3 text-center">
                                  <UrgencyDot dueDate={row.dueDate} status={row.status} />
                                </td>
                                <td className="px-3 py-3">
                                  <p className="font-medium text-gray-900 text-sm">{row.requirementType}</p>
                                  {row.description && <p className="text-xs text-gray-400 mt-0.5">{row.description}</p>}
                                </td>
                                <td className="px-3 py-3 text-xs text-gray-600">{row.regulator}</td>
                                <td className="px-3 py-3">
                                  <p className="text-xs font-medium text-gray-800">{formatDue(row.dueDate)}</p>
                                  <UrgencyBadge dueDate={row.dueDate} status={row.status} />
                                </td>
                                <td className="px-3 py-3 text-xs text-gray-500 capitalize">{row.recurrence}</td>
                                <td className="px-3 py-3 text-xs text-gray-600">
                                  {dri.compliance && <p>C: {dri.compliance}</p>}
                                  {dri.finance && <p>F: {dri.finance}</p>}
                                  {!dri.compliance && !dri.finance && <p>{row.owner}</p>}
                                </td>
                                <td className="px-3 py-3">
                                  <select
                                    value={row.status}
                                    onChange={e => updateStatus(row.id, e.target.value)}
                                    className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer ${STATUS_CONFIG[row.status]?.color ?? 'bg-gray-100 text-gray-600'}`}
                                  >
                                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                  </select>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-gray-400 hover:text-indigo-600" title="Edit">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(row)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600" title="Delete">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Entry Modal ── */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Regulatory Filing" subtitle="Manually add a compliance obligation to the calendar">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Entity" required className="col-span-2">
              <Select
                value={addForm.entityId}
                onChange={e => setAddForm(p => ({ ...p, entityId: e.target.value }))}
                required
                placeholder="Select entity"
                options={entities.map(e => ({ value: e.id, label: e.name }))}
              />
            </FormField>
            <FormField label="Filing / Requirement" required className="col-span-2">
              <Input value={addForm.requirementType} onChange={e => setAddForm(p => ({ ...p, requirementType: e.target.value }))} required placeholder="e.g. Annual Return" />
            </FormField>
            <FormField label="Regulator" required>
              <Input value={addForm.regulator} onChange={e => setAddForm(p => ({ ...p, regulator: e.target.value }))} required placeholder="e.g. MAS" />
            </FormField>
            <FormField label="Due Date" required>
              <Input type="date" value={addForm.dueDate} onChange={e => setAddForm(p => ({ ...p, dueDate: e.target.value }))} required />
            </FormField>
            <FormField label="Recurrence">
              <Select value={addForm.recurrence} onChange={e => setAddForm(p => ({ ...p, recurrence: e.target.value }))} options={RECURRENCES} />
            </FormField>
            <FormField label="Owner / Lead Team">
              <Input value={addForm.owner} onChange={e => setAddForm(p => ({ ...p, owner: e.target.value }))} placeholder="Compliance" />
            </FormField>
            <FormField label="Description" className="col-span-2">
              <Input value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Annual · Dec 31" />
            </FormField>
            <FormField label="Notes / DRI" className="col-span-2" hint="e.g. Compliance DRI: Jane | Finance DRI: Matt">
              <Input value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))} placeholder="Compliance DRI: … | Finance DRI: …" />
            </FormField>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" loading={addSaving}>Add Entry</Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Entry Modal ── */}
      <Modal isOpen={!!editRow} onClose={() => setEditRow(null)} title="Edit Filing" subtitle={editRow?.requirementType}>
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Filing / Requirement" required className="col-span-2">
              <Input value={editForm.requirementType} onChange={e => setEditForm(p => ({ ...p, requirementType: e.target.value }))} required />
            </FormField>
            <FormField label="Regulator" required>
              <Input value={editForm.regulator} onChange={e => setEditForm(p => ({ ...p, regulator: e.target.value }))} required />
            </FormField>
            <FormField label="Due Date" required>
              <Input type="date" value={editForm.dueDate} onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))} required />
            </FormField>
            <FormField label="Recurrence">
              <Select value={editForm.recurrence} onChange={e => setEditForm(p => ({ ...p, recurrence: e.target.value }))} options={RECURRENCES} />
            </FormField>
            <FormField label="Status">
              <Select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} options={STATUSES} />
            </FormField>
            <FormField label="Owner / Lead Team">
              <Input value={editForm.owner} onChange={e => setEditForm(p => ({ ...p, owner: e.target.value }))} />
            </FormField>
            <FormField label="Description">
              <Input value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
            </FormField>
            <FormField label="Notes / DRI" className="col-span-2">
              <Input value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
            </FormField>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button type="submit" loading={editSaving}>Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
