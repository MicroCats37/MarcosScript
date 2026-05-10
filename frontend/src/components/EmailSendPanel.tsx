import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import { useEventStore, ProcessedFrame, EmailSendRecord, CipLookupResult } from '../stores/EventContext';
import { getMediaUrl } from '../api/client';
import { LoadingSpinner } from '../App';

interface EmailSendPanelProps {
  sendableFrames: ProcessedFrame[];
  outputPath: string;
  eventId: number;
}

interface RecipientEntry {
  cip?: string;
  name?: string;
  email: string;
}

export const EmailSendPanel: Component<EmailSendPanelProps> = (props) => {
  const store = useEventStore();

  const [selectedFrameIds, setSelectedFrameIds] = createSignal<Set<number>>(new Set());
  const [recipients, setRecipients] = createSignal<RecipientEntry[]>([{ email: '' }]);
  const [subject, setSubject] = createSignal('');
  const [body, setBody] = createSignal('');
  const [html, setHtml] = createSignal(true);
  const [cipSearch, setCipSearch] = createSignal('');
  const [cipResult, setCipResult] = createSignal<CipLookupResult | null>(null);
  const [cipLoading, setCipLoading] = createSignal(false);
  const [cipError, setCipError] = createSignal<string | null>(null);
  const [sending, setSending] = createSignal(false);
  const [sendError, setSendError] = createSignal<string | null>(null);
  const [showHistory, setShowHistory] = createSignal(false);
  const [history, setHistory] = createSignal<EmailSendRecord[]>([]);
  const [historyLoading, setHistoryLoading] = createSignal(false);
  const [activeRecipientIdx, setActiveRecipientIdx] = createSignal(0);

  const toggleFrame = (frameId: number) => {
    const newSet = new Set(selectedFrameIds());
    newSet.has(frameId) ? newSet.delete(frameId) : newSet.add(frameId);
    setSelectedFrameIds(newSet);
  };

  const selectAllSendable = () => {
    setSelectedFrameIds(new Set(props.sendableFrames.map((f) => f.id)));
  };

  const deselectAll = () => setSelectedFrameIds(new Set());

  const addRecipient = () => {
    setRecipients((prev) => [...prev, { email: '' }]);
  };

  const removeRecipient = (idx: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRecipient = (idx: number, field: keyof RecipientEntry, value: string) => {
    setRecipients((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  };

  const applyCipToRecipient = (cipData: CipLookupResult, idx: number) => {
    setRecipients((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { cip: cipData.cip, name: cipData.name || r.name, email: cipData.email || r.email }
          : r
      )
    );
  };

  const handleCipLookup = async () => {
    const cip = cipSearch().trim();
    if (!cip) return;
    setCipLoading(true);
    setCipError(null);
    setCipResult(null);
    try {
      const result = await store.cipLookup(cip);
      setCipResult(result);
      if (result.found && result.email) {
        applyCipToRecipient(result, activeRecipientIdx());
      }
    } catch (e) {
      setCipError(e instanceof Error ? e.message : 'CIP lookup failed');
    } finally {
      setCipLoading(false);
    }
  };

  const canSend = createMemo(
    () =>
      selectedFrameIds().size > 0 &&
      recipients().some((r) => r.email.trim()) &&
      subject().trim() &&
      !sending()
  );

  const handleSend = async () => {
    if (!canSend()) return;
    setSending(true);
    setSendError(null);
    try {
      const validRecipients = recipients().filter((r) => r.email.trim());
      const result = await store.sendEmail(props.eventId, {
        processed_frame_ids: Array.from(selectedFrameIds()),
        recipients: validRecipients,
        subject: subject(),
        body: body() || undefined,
        html: html(),
      });
      if (result && result.length > 0) {
        setSubject('');
        setBody('');
        setSelectedFrameIds(new Set());
        setRecipients([{ email: '' }]);
        await loadHistory();
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const records = await store.listEmailSends(props.eventId);
      setHistory(records);
    } catch (e) {
      console.error('Failed to load history', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = async () => {
    if (!showHistory()) {
      await loadHistory();
    }
    setShowHistory((v) => !v);
  };

  const handleRetryUpload = async (frameId: number) => {
    try {
      await store.retryDriveUpload(frameId);
    } catch (e) {
      console.error('Retry upload failed', e);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const statusBadge = (status: string) => {
    const base = 'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase';
    if (status === 'sent_to_noti') return `${base} bg-green-900/40 text-green-300 border border-green-700/50`;
    if (status === 'failed') return `${base} bg-red-900/40 text-red-300 border border-red-700/50`;
    if (status === 'pending') return `${base} bg-amber-900/40 text-amber-300 border border-amber-700/50`;
    return `${base} bg-slate-800 text-slate-400 border border-slate-700`;
  };

  return (
    <div class="email-send-panel flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar animate-fade-in">
      {/* Header */}
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-blue-100">Email Send</h3>
        <button
          onClick={toggleHistory}
          class="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-lg border border-slate-700 hover:border-slate-600 transition-all"
        >
          {showHistory() ? 'Hide History' : 'Show History'}
        </button>
      </div>

      {/* History Panel */}
      <Show when={showHistory()}>
        <div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
          <h4 class="text-sm font-bold text-blue-200 mb-3">Send History</h4>
          <Show when={historyLoading()}>
            <div class="py-4"><LoadingSpinner size="sm" /></div>
          </Show>
          <Show when={!historyLoading() && history().length === 0}>
            <p class="text-xs text-blue-400/50 italic">No sends yet.</p>
          </Show>
          <div class="flex flex-col gap-2 max-h-48 overflow-y-auto">
            <For each={history()}>
              {(send) => (
                <div class="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-semibold text-blue-200 truncate">{send.recipient_email}</span>
                    <span class={statusBadge(send.status)}>{send.status}</span>
                  </div>
                  <p class="text-[10px] text-blue-400/70 truncate">{send.subject}</p>
                  <p class="text-[9px] text-blue-500/50 mt-0.5">{formatDate(send.created_at)}</p>
                  <Show when={send.error_message}>
                    <p class="text-[9px] text-red-400 mt-0.5">Error: {send.error_message}</p>
                  </Show>
                  <div class="flex gap-1 mt-1 flex-wrap">
                    <For each={send.items}>
                      {(item) => (
                        <span class="text-[9px] bg-slate-800/80 px-1.5 py-0.5 rounded text-blue-300/80 truncate max-w-[120px]" title={item.drive_link}>
                          #{item.processed_frame_id}
                        </span>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Sendable Frames Selection */}
      <div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-bold text-blue-200">
            Sendable Photos ({props.sendableFrames.length})
          </h4>
          <div class="flex gap-2">
            <button onClick={selectAllSendable} class="px-2 py-1 text-[10px] font-semibold bg-slate-800 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-all">
              All
            </button>
            <button onClick={deselectAll} class="px-2 py-1 text-[10px] font-semibold bg-slate-800 hover:bg-red-900/30 text-blue-300 hover:text-red-400 rounded-lg border border-slate-700 hover:border-red-500/50 transition-all">
              Clear
            </button>
          </div>
        </div>
        <Show when={props.sendableFrames.length === 0}>
          <p class="text-xs text-blue-400/50 italic">No sendable photos yet. Process photos and ensure Drive upload succeeds.</p>
        </Show>
        <div class="flex flex-col gap-2 max-h-48 overflow-y-auto">
          <For each={props.sendableFrames}>
            {(frame) => (
              <div
                class={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                  selectedFrameIds().has(frame.id)
                    ? 'bg-blue-600/10 border-blue-500/50'
                    : 'bg-slate-900/40 border-slate-700/50 hover:border-slate-600'
                }`}
                onClick={() => toggleFrame(frame.id)}
              >
                <div class={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                  selectedFrameIds().has(frame.id) ? 'bg-blue-600 border-blue-400' : 'bg-slate-800 border-slate-600'
                }`}>
                  <Show when={selectedFrameIds().has(frame.id)}>
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </Show>
                </div>
                <img
                  src={getMediaUrl(`${props.outputPath}/${frame.output_filename}`)}
                  alt={frame.frame_filename}
                  class="w-10 h-10 object-cover rounded border border-slate-700"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-xs text-blue-200 truncate">{frame.frame_filename}</p>
                  <p class="text-[9px] text-blue-500/60 truncate">{frame.output_filename}</p>
                </div>
                <Show when={frame.drive_upload_error}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRetryUpload(frame.id); }}
                    class="px-2 py-1 text-[9px] font-semibold bg-amber-900/30 hover:bg-amber-800/50 text-amber-400 rounded border border-amber-700/50 transition-all"
                    title={frame.drive_upload_error || 'Retry Drive upload'}
                  >
                    Retry
                  </button>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* CIP Lookup */}
      <div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
        <h4 class="text-sm font-bold text-blue-200 mb-3">CIP Lookup</h4>
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Enter CIP number..."
            value={cipSearch()}
            onInput={(e) => setCipSearch(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCipLookup()}
            class="flex-1 bg-slate-900 border border-slate-700 text-blue-200 text-xs rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
          />
          <button
            onClick={handleCipLookup}
            disabled={cipLoading() || !cipSearch().trim()}
            class="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-all"
          >
            {cipLoading() ? '...' : 'Lookup'}
          </button>
        </div>
        <Show when={cipError()}>
          <p class="text-xs text-red-400 mt-2 bg-red-900/20 p-2 rounded border border-red-800/50">{cipError()}</p>
        </Show>
        <Show when={cipResult()}>
          <div class={`mt-3 p-3 rounded-lg border ${
            cipResult()!.found ? 'bg-green-900/20 border-green-700/50' : 'bg-slate-900/40 border-slate-700/50'
          }`}>
            <Show when={cipResult()!.found}>
              <p class="text-xs text-green-300">
                <span class="font-bold">{cipResult()!.cip}</span>
                {cipResult()!.name && ` — ${cipResult()!.name}`}
              </p>
              <p class="text-xs text-green-400 mt-0.5">{cipResult()!.email}</p>
              <button
                onClick={() => applyCipToRecipient(cipResult()!, activeRecipientIdx())}
                class="mt-2 px-3 py-1 text-[10px] font-semibold bg-green-700/40 hover:bg-green-600 text-green-300 rounded border border-green-600/50 transition-all"
              >
                Apply to Recipient
              </button>
            </Show>
            <Show when={!cipResult()!.found}>
              <p class="text-xs text-blue-400/70 italic">CIP not found. Enter email manually below.</p>
            </Show>
          </div>
        </Show>
      </div>

      {/* Recipients */}
      <div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-bold text-blue-200">Recipients</h4>
          <button
            onClick={addRecipient}
            class="px-3 py-1 text-[10px] font-semibold bg-slate-800 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-all"
          >
            + Add
          </button>
        </div>
        <div class="flex flex-col gap-2">
          <For each={recipients()}>
            {(recipient, idx) => (
              <div class="flex gap-2 items-start bg-slate-900/40 rounded-lg p-2 border border-slate-700/50">
                <div class="flex flex-col gap-1 flex-1 min-w-0">
                  <div class="flex gap-2">
                    <input
                      type="text"
                      placeholder="CIP"
                      value={recipient.cip || ''}
                      onInput={(e) => { updateRecipient(idx(), 'cip', e.currentTarget.value); setActiveRecipientIdx(idx()); }}
                      class="w-20 bg-slate-800 border border-slate-700 text-blue-300 text-[10px] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500"
                    />
                    <input
                      type="text"
                      placeholder="Name"
                      value={recipient.name || ''}
                      onInput={(e) => updateRecipient(idx(), 'name', e.currentTarget.value)}
                      class="flex-1 bg-slate-800 border border-slate-700 text-blue-300 text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500"
                    />
                  </div>
                  <input
                    type="email"
                    placeholder="Email *"
                    value={recipient.email}
                    onInput={(e) => { updateRecipient(idx(), 'email', e.currentTarget.value); setActiveRecipientIdx(idx()); }}
                    class="w-full bg-slate-800 border border-slate-700 text-blue-200 text-xs rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                  />
                </div>
                <Show when={recipients().length > 1}>
                  <button
                    onClick={() => removeRecipient(idx())}
                    class="mt-1 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-900/30 rounded transition-all"
                  >
                    ×
                  </button>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Email Content */}
      <div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
        <h4 class="text-sm font-bold text-blue-200 mb-3">Email Content</h4>
        <div class="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Subject *"
            value={subject()}
            onInput={(e) => setSubject(e.currentTarget.value)}
            class="w-full bg-slate-900 border border-slate-700 text-blue-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
          />
          <textarea
            placeholder="Body (optional). Photo links will be appended automatically."
            value={body()}
            onInput={(e) => setBody(e.currentTarget.value)}
            rows={3}
            class="w-full bg-slate-900 border border-slate-700 text-blue-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder-slate-500"
          />
          <label class="flex items-center gap-2 text-xs text-blue-400/70 cursor-pointer">
            <input type="checkbox" checked={html()} onChange={(e) => setHtml(e.currentTarget.checked)} class="w-4 h-4 rounded bg-slate-800 border-slate-600" />
            Send as HTML
          </label>
        </div>
      </div>

      {/* Send Button & Status */}
      <div class="flex flex-col gap-2">
        <Show when={sendError()}>
          <p class="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2 border border-red-800/50">{sendError()}</p>
        </Show>
        <button
          onClick={handleSend}
          disabled={!canSend()}
          class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg disabled:cursor-not-allowed"
        >
          {sending() ? (
            <span class="flex items-center justify-center gap-2">
              <span class="spinner w-4 h-4 border-2 border-white/30 border-t-white" />
              Sending...
            </span>
          ) : `Send ${selectedFrameIds().size} Photo(s) to ${recipients().filter(r => r.email.trim()).length} Recipient(s)`}
        </button>
      </div>
    </div>
  );
};
