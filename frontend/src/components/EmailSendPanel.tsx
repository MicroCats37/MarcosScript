import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import { useEventStore, ProcessedFrame, EmailSendRecord, CipLookupResult, isSendable } from '../stores/EventContext';
import { getMediaUrl } from '../api/client';
import { LoadingSpinner } from '../App';

interface EmailSendPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sendableFrames: ProcessedFrame[];
  outputPath: string;
  eventId: number;
  onSuccess?: () => void;
}

interface RecipientEntry {
  cip?: string;
  name?: string;
  email: string;
  emailError?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EmailSendPanel: Component<EmailSendPanelProps> = (props) => {
  const store = useEventStore();

  const [selectedFrameIds, setSelectedFrameIds] = createSignal<Set<number>>(new Set());
  const [recipients, setRecipients] = createSignal<RecipientEntry[]>([{ email: '' }]);
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
  const [showDiscardConfirm, setShowDiscardConfirm] = createSignal(false);
  const [cipRecipientIdx, setCipRecipientIdx] = createSignal<number | null>(null);

  // Dirty flag: meaningful edits have been made
  const isDirty = createMemo(
    () =>
      selectedFrameIds().size > 0 ||
      recipients().some((r) => r.email.trim())
  );

  // Check if CIP data is being used (any recipient has CIP filled)
  const usesCipData = createMemo(
    () => recipients().some((r) => r.cip && r.cip.trim())
  );

  // Group sendable frames by Photo
  const photosWithSendableFrames = createMemo(() => {
    return store.state.photos
      .filter((photo) => photo.processed_frames.some(isSendable))
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      })
      .map((photo) => ({
        photo,
        sendableFrames: photo.processed_frames
          .filter(isSendable)
          .sort((a, b) => {
            const ta = a.processed_at ? new Date(a.processed_at).getTime() : 0;
            const tb = b.processed_at ? new Date(b.processed_at).getTime() : 0;
            return tb - ta;
          }),
      }));
  });

  // Check if all frames in a photo are selected
  const isPhotoFullySelected = (photoId: number) => {
    const photoData = photosWithSendableFrames().find((p) => p.photo.id === photoId);
    if (!photoData) return false;
    return photoData.sendableFrames.every((f) => selectedFrameIds().has(f.id));
  };

  // Toggle all sendable frames for a photo
  const togglePhotoFrames = (photoId: number) => {
    const photoData = photosWithSendableFrames().find((p) => p.photo.id === photoId);
    if (!photoData) return;
    const allSelected = isPhotoFullySelected(photoId);
    const newSet = new Set(selectedFrameIds());
    if (allSelected) {
      photoData.sendableFrames.forEach((f) => newSet.delete(f.id));
    } else {
      photoData.sendableFrames.forEach((f) => newSet.add(f.id));
    }
    setSelectedFrameIds(newSet);
  };

  const toggleFrame = (frameId: number) => {
    const newSet = new Set(selectedFrameIds());
    newSet.has(frameId) ? newSet.delete(frameId) : newSet.add(frameId);
    setSelectedFrameIds(newSet);
  };

  const selectAllSendable = () => {
    const allIds = photosWithSendableFrames().flatMap((p) => p.sendableFrames.map((f) => f.id));
    setSelectedFrameIds(new Set(allIds));
  };

  const deselectAll = () => setSelectedFrameIds(new Set<number>());

  const addRecipient = () => {
    setRecipients((prev) => [...prev, { email: '' }]);
  };

  const removeRecipient = (idx: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRecipient = (idx: number, field: keyof RecipientEntry, value: string) => {
    if (field === 'cip') {
      // Restrict to digits only, max 9 digits
      const digitsOnly = value.replace(/\D/g, '').slice(0, 9);
      setRecipients((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, cip: digitsOnly } : r))
      );
    } else if (field === 'email') {
      setRecipients((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, email: value, emailError: undefined } : r))
      );
    } else {
      setRecipients((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
      );
    }
  };

  // Validate all emails
  const validateEmails = () => {
    let hasError = false;
    setRecipients((prev) =>
      prev.map((r) => {
        if (r.email.trim() && !EMAIL_REGEX.test(r.email.trim())) {
          hasError = true;
          return { ...r, emailError: 'Invalid email address' };
        }
        return { ...r, emailError: undefined };
      })
    );
    return !hasError;
  };

  const applyCipToRecipient = (cipData: CipLookupResult, idx: number) => {
    setRecipients((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { cip: cipData.cip, name: cipData.name || r.name, email: cipData.email || r.email }
          : r
      )
    );
    setCipRecipientIdx(idx);
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

  const handleClose = () => {
    if (isDirty()) {
      setShowDiscardConfirm(true);
    } else {
      props.onClose();
    }
  };

  const confirmDiscard = () => {
    setShowDiscardConfirm(false);
    resetForm();
    props.onClose();
  };

  const cancelDiscard = () => {
    setShowDiscardConfirm(false);
  };

  const resetForm = () => {
    setSelectedFrameIds(new Set<number>());
    setRecipients([{ email: '' }]);
    setCipSearch('');
    setCipResult(null);
    setCipError(null);
    setCipRecipientIdx(null);
  };

  const canSend = createMemo(() => {
    if (selectedFrameIds().size === 0) return false;
    const validRecipients = recipients().filter((r) => r.email.trim());
    if (validRecipients.length === 0) return false;
    // Check for invalid emails
    const hasInvalidEmail = recipients().some(
      (r) => r.email.trim() && !EMAIL_REGEX.test(r.email.trim())
    );
    if (hasInvalidEmail) return false;
    if (usesCipData() && cipRecipientIdx() === null) return false;
    return !sending();
  });

  const handleSend = async () => {
    if (!canSend()) return;
    if (!validateEmails()) return;
    setSending(true);
    setSendError(null);
    try {
      const validRecipients = recipients()
        .filter((r) => r.email.trim())
        .map(({ emailError, ...r }) => r);
      const result = await store.sendEmail(props.eventId, {
        processed_frame_ids: Array.from(selectedFrameIds()),
        recipients: validRecipients,
        subject: '¡Feliz Día de la Madre! - Colegio de Ingenieros del Perú',
        html: true,
      });
      // Close modal on successful send
      if (result && result.length > 0) {
        resetForm();
        props.onSuccess?.();
        props.onClose();
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
    const base = 'text-[10px] px-2 py-0.5 rounded-sm font-bold uppercase tracking-wide';
    if (status === 'sent_to_noti') return `${base} bg-emerald-900/40 text-emerald-300 border border-emerald-700/50`;
    if (status === 'failed') return `${base} bg-red-900/40 text-red-300 border border-red-700/50`;
    if (status === 'pending') return `${base} bg-amber-900/40 text-amber-300 border border-amber-700/50`;
    return `${base} bg-slate-800 text-slate-400 border border-slate-700`;
  };

  const selectedFrameCount = createMemo(() => selectedFrameIds().size);
  const recipientCount = createMemo(() => recipients().filter((r) => r.email.trim()).length);
  const selectedCipRecipient = createMemo(() => {
    const idx = cipRecipientIdx();
    return idx !== null ? recipients()[idx] : null;
  });

  if (!props.isOpen) return null;

  return (
    <>
      {/* Modal Backdrop */}
      <div
        class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-modal-title"
      >
        <div class="pointer-events-auto w-full max-w-6xl max-h-[90vh] bg-slate-900 border border-slate-700 shadow-2xl shadow-black flex flex-col overflow-hidden rounded-xl">
          {/* Modal Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-600/50 flex items-center justify-center">
                <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 id="email-modal-title" class="text-lg font-bold text-slate-100 tracking-tight">
                Send Photos via Email
              </h2>
            </div>
            <button
              onClick={handleClose}
              class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-all hover:border-slate-600"
              aria-label="Close modal"
            >
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Body */}
          <div class="flex-1 overflow-y-auto custom-scrollbar">
            <div class="grid grid-cols-12 gap-6 p-6">
              {/* Left Column: Recipients + CIP Lookup */}
              <div class="col-span-5 flex flex-col gap-4">
                {/* History Toggle */}
                <div class="flex items-center justify-end">
                  <button
                    onClick={toggleHistory}
                    class="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 hover:border-slate-600 transition-all"
                  >
                    {showHistory() ? 'Hide History' : 'Show History'}
                  </button>
                </div>

                {/* History Panel */}
                <Show when={showHistory()}>
                  <div class="bg-slate-800/40 border border-slate-700 p-4 rounded-xl">
                    <h4 class="text-sm font-bold text-slate-200 mb-3">Send History</h4>
                    <Show when={historyLoading()}>
                      <div class="py-4"><LoadingSpinner size="sm" /></div>
                    </Show>
                    <Show when={!historyLoading() && history().length === 0}>
                      <p class="text-xs text-slate-500 italic">No sends yet.</p>
                    </Show>
                    <div class="flex flex-col gap-2 max-h-48 overflow-y-auto">
                      <For each={history()}>
                        {(send) => (
                          <div class="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
                            <div class="flex items-center justify-between mb-1">
                              <span class="text-xs font-semibold text-slate-200 truncate">{send.recipient_email}</span>
                              <span class={statusBadge(send.status)}>{send.status}</span>
                            </div>
                            <p class="text-[10px] text-slate-400 truncate">{send.subject}</p>
                            <p class="text-[9px] text-slate-600 mt-0.5">{formatDate(send.created_at)}</p>
                            <Show when={send.error_message}>
                              <p class="text-[9px] text-red-400 mt-0.5">Error: {send.error_message}</p>
                            </Show>
                            <div class="flex gap-1 mt-1 flex-wrap">
                              <For each={send.items}>
                                {(item) => (
                                  <span class="text-[9px] bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-400 truncate max-w-[120px]" title={item.drive_link}>
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

                {/* CIP Lookup */}
                <div class="bg-slate-800/40 border border-slate-700 p-4 rounded-xl">
                  <h4 class="text-sm font-bold text-slate-200 mb-3">CIP Lookup</h4>
                  <div class="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter CIP number..."
                      value={cipSearch()}
                      onInput={(e) => setCipSearch(e.currentTarget.value.replace(/\D/g, '').slice(0, 9))}
                      onKeyDown={(e) => e.key === 'Enter' && handleCipLookup()}
                      class="flex-1 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-600"
                    />
                    <button
                      onClick={handleCipLookup}
                      disabled={cipLoading() || !cipSearch().trim()}
                      class="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-all"
                    >
                      {cipLoading() ? '...' : 'Lookup'}
                    </button>
                  </div>
                  <Show when={cipError()}>
                    <p class="text-xs text-red-400 mt-2 bg-red-900/20 p-2 rounded-lg border border-red-800/50">{cipError()}</p>
                  </Show>
                  <Show when={cipResult()}>
                    <div class={`mt-3 p-3 rounded-lg border ${
                      cipResult()!.found ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-slate-900/40 border-slate-700/50'
                    }`}>
                      <Show when={cipResult()!.found}>
                        <p class="text-xs text-emerald-300">
                          <span class="font-bold">{cipResult()!.cip}</span>
                          {cipResult()!.name && ` — ${cipResult()!.name}`}
                        </p>
                        <p class="text-xs text-emerald-400 mt-0.5">{cipResult()!.email}</p>
                        <button
                          onClick={() => applyCipToRecipient(cipResult()!, activeRecipientIdx())}
                          class="mt-2 px-3 py-1 text-[10px] font-semibold bg-emerald-700/40 hover:bg-emerald-600 text-emerald-300 rounded-lg border border-emerald-600/50 transition-all"
                        >
                          Use as CIP Recipient
                        </button>
                      </Show>
                      <Show when={!cipResult()!.found}>
                        <p class="text-xs text-slate-500 italic">CIP not found. Enter email manually below.</p>
                      </Show>
                    </div>
                  </Show>
                </div>

                {/* Recipients */}
                <div class="bg-slate-800/40 border border-slate-700 p-4 rounded-xl">
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-bold text-slate-200">Recipients</h4>
                    <button
                      onClick={addRecipient}
                      class="px-3 py-1 text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 hover:border-slate-600 transition-all"
                    >
                      + Add
                    </button>
                  </div>
                  <div class="flex flex-col gap-2">
                    <For each={recipients()}>
                      {(recipient, idx) => (
                        <div class={`flex gap-2 items-start bg-slate-900/40 rounded-lg p-2 border transition-all ${
                          cipRecipientIdx() === idx() ? 'border-emerald-500 bg-emerald-900/10' : 'border-slate-800'
                        }`}>
                          <div class="flex flex-col gap-1 flex-1 min-w-0">
                            <div class="flex gap-2">
                              <input
                                type="text"
                                placeholder="CIP (digits only)"
                                value={recipient.cip || ''}
                                onInput={(e) => { updateRecipient(idx(), 'cip', e.currentTarget.value); setActiveRecipientIdx(idx()); }}
                                class="w-24 bg-slate-950 border border-slate-700 text-slate-300 text-[10px] rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-600"
                                maxLength={9}
                              />
                              <input
                                type="text"
                                placeholder="Name"
                                value={recipient.name || ''}
                                onInput={(e) => updateRecipient(idx(), 'name', e.currentTarget.value)}
                                class="flex-1 bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-600"
                              />
                            </div>
                            <input
                              type="email"
                              placeholder="Email *"
                              value={recipient.email}
                              onInput={(e) => { updateRecipient(idx(), 'email', e.currentTarget.value); setActiveRecipientIdx(idx()); }}
                              class="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-600"
                            />
                            <Show when={recipient.emailError}>
                              <p class="text-xs text-red-400 bg-red-900/30 p-1.5 rounded-lg border border-red-800/50">
                                {recipient.emailError}
                              </p>
                            </Show>
                          </div>
                          <Show when={cipRecipientIdx() === idx()}>
                            <div class="mt-1 px-2 py-1 text-[9px] font-bold text-emerald-400 bg-emerald-900/30 rounded-lg border border-emerald-700/50 flex-shrink-0">
                              CIP
                            </div>
                          </Show>
                          <Show when={recipients().length > 1}>
                            <button
                              onClick={() => removeRecipient(idx())}
                              class="mt-1 px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-red-400 rounded-lg transition-all flex-shrink-0"
                            >
                              ×
                            </button>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                  <Show when={usesCipData() && cipRecipientIdx() === null}>
                    <p class="text-xs text-amber-400 mt-2 bg-amber-900/20 p-2 rounded-lg border border-amber-700/50">
                      Select a recipient to be the CIP recipient using "Use as CIP Recipient" above.
                    </p>
                  </Show>
                </div>

                {/* Validation Error */}
                <Show when={!canSend() && selectedFrameIds().size > 0 && recipients().some((r) => r.email.trim())}>
                  <p class="text-xs text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-800/50">
                    Please fix email validation errors before sending.
                  </p>
                </Show>

                {/* Action Bar */}
                <div class="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    class="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 hover:border-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!canSend()}
                    class="px-6 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30"
                  >
                    <Show when={sending()}>
                      <span class="spinner w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                      Sending...
                    </Show>
                    <Show when={!sending()}>
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Emails
                    </Show>
                  </button>
                </div>
              </div>

              {/* Right Column: Image Selection grouped by Photo */}
              <div class="col-span-7 flex flex-col gap-4">
                <div class="bg-slate-800/40 border border-slate-700 p-4 rounded-xl flex flex-col" style="max-height: calc(90vh - 8rem);">
                  <div class="flex items-center justify-between mb-4 flex-shrink-0">
                    <h4 class="text-sm font-bold text-slate-200">
                      Sendable Photos ({selectedFrameCount()} selected)
                    </h4>
                    <div class="flex gap-2">
                      <button onClick={selectAllSendable} class="px-3 py-1.5 text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 hover:border-slate-600 transition-all">
                        Select All
                      </button>
                      <button onClick={deselectAll} class="px-3 py-1.5 text-[10px] font-semibold bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-400 rounded-lg border border-slate-700 hover:border-red-700/50 transition-all">
                        Clear
                      </button>
                    </div>
                  </div>
                  <Show when={photosWithSendableFrames().length === 0}>
                    <p class="text-xs text-slate-500 italic">No sendable photos yet. Process photos and ensure Drive upload succeeds.</p>
                  </Show>
                  <div class="flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
                    <For each={photosWithSendableFrames()}>
                      {({ photo, sendableFrames }) => {
                        const isFullySelected = isPhotoFullySelected(photo.id);
                        return (
                          <div class="bg-slate-900/40 rounded-xl border border-slate-800 p-3">
                            {/* Photo Header with Select All */}
                            <div
                              class="flex items-center gap-3 mb-3 cursor-pointer"
                              onClick={() => togglePhotoFrames(photo.id)}
                            >
                              <div class={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                isFullySelected
                                  ? 'bg-blue-600 border-blue-500'
                                  : 'bg-slate-800 border-slate-600 hover:border-slate-500'
                              }`}>
                                <Show when={isFullySelected}>
                                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                                  </svg>
                                </Show>
                              </div>
                              <div class="flex-1 min-w-0">
                                <p class="text-sm text-slate-200 truncate font-semibold">
                                  Original: {photo.filename}
                                </p>
                                <p class="text-[10px] text-slate-500">{sendableFrames.length} frame{sendableFrames.length !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            {/* Frames Grid */}
                            <div class="grid grid-cols-2 gap-4">
                              <For each={sendableFrames}>
                                {(frame) => (
                                  <div
                                    class={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                                      selectedFrameIds().has(frame.id)
                                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                                        : 'border-slate-700 hover:border-slate-600'
                                    }`}
                                    onClick={() => toggleFrame(frame.id)}
                                  >
                                    <img
                                      src={getMediaUrl(`${props.outputPath}/${frame.output_filename}`)}
                                      alt={frame.frame_filename}
                                      class="w-full h-40 object-cover"
                                    />
                                    <Show when={selectedFrameIds().has(frame.id)}>
                                      <div class="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    </Show>
                                    <div class="p-2 bg-slate-900/80">
                                      <p class="text-[10px] text-slate-300 truncate font-medium">{frame.frame_filename}</p>
                                      <Show when={frame.drive_web_view_link}>
                                        <p class="text-[9px] text-emerald-400 truncate mt-0.5">
                                          <svg class="w-3 h-3 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                          </svg>
                                          Drive linked
                                        </p>
                                      </Show>
                                    </div>
                                    <Show when={frame.drive_upload_error}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleRetryUpload(frame.id); }}
                                        class="absolute bottom-2 right-2 px-2 py-1 text-[9px] font-semibold bg-amber-900/80 hover:bg-amber-800 text-amber-300 rounded-lg border border-amber-600/50 transition-all"
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
                        );
                      }}
                    </For>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Discard Confirmation Dialog */}
      <Show when={showDiscardConfirm()}>
        <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-slate-700 shadow-2xl shadow-black p-6 max-w-sm w-full rounded-xl">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-lg bg-amber-900/30 border border-amber-700/50 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 class="text-base font-bold text-slate-100">Discard unsent changes?</h3>
            </div>
            <p class="text-sm text-slate-400 mb-5">You have unsaved changes. Are you sure you want to close and discard them?</p>
            <div class="flex items-center justify-end gap-3">
              <button
                onClick={cancelDiscard}
                class="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 hover:border-slate-600 transition-all"
              >
                Keep Editing
              </button>
              <button
                onClick={confirmDiscard}
                class="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};