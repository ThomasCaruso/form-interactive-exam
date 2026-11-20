import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { showToast } from '../Toast';
import { studioConfigured, studioMode, StudioError, studioRequest, submitStudioPreview, type StudioJob } from '../../providers/higgsfield';
import type { TryOnScene } from '../../domain/tryOnScene';
import type { PersonReference, Product } from '../../domain/types';

export const manualStudio = studioMode === 'codex';
const KEY = manualStudio ? 'form-codex-preview-v1' : 'form-higgsfield-preview-v1';
export const jobRunning = (job: StudioJob | null) => !!job && ['queued', 'preparing', 'submitting', 'processing'].includes(job.status);

/** The one stored studio job: restore, connect, poll and create. Moved verbatim from TryOnGeneration. */
export function useStudioJob() {
  const [job, setJob] = useState<StudioJob | null>(null), [ready, setReady] = useState(false), [checked, setChecked] = useState(false), [hydrated, setHydrated] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [health, setHealth] = useState('Connecting your studio…'), [focused, setFocused] = useState(false);
  const mounted = useRef(true), locked = useRef(false);
  useEffect(() => { mounted.current = true; void AsyncStorage.getItem(KEY).then(raw => { if (!mounted.current) return; if (raw) { const stored = JSON.parse(raw); if (!/^[a-zA-Z0-9_-]{8,80}$/.test(stored.id)) throw Error('Invalid saved preview'); setJob(stored); } setHydrated(true); }).catch(() => { if (mounted.current) setError('Could not restore your previous preview. Reopen FORM before creating another.'); }); return () => { mounted.current = false; }; }, []);
  async function save(value: StudioJob) { await AsyncStorage.setItem(KEY, JSON.stringify(value)); if (mounted.current) setJob(value); }
  const connect = useCallback(async () => { try { const status = await studioRequest<{ready:boolean;message?:string;provider?:string}>('/health'); if (mounted.current) { const matches = (status.provider ?? 'higgsfield') === studioMode; setReady(status.ready && matches); setHealth(!matches ? 'Restart your studio bridge in the selected mode.' : status.ready ? (manualStudio ? 'Manual test mode · previews are made by hand, not automatically' : 'Connected to your Higgsfield studio') : status.message ?? 'Start your studio on the computer.'); } } catch(e) { if (mounted.current) { setReady(false); setHealth(e instanceof StudioError ? e.message : !studioConfigured ? 'Try-on isn’t connected in this build.' : 'Your studio isn’t running on your computer.'); } } finally { if (mounted.current) setChecked(true); } }, []);
  useFocusEffect(useCallback(() => { setFocused(true); void connect(); return () => setFocused(false); }, [connect]));
  useEffect(() => { if (!ready || !focused || !jobRunning(job)) return; let canceled = false; const poll = setTimeout(() => { void studioRequest<StudioJob>('/tryon/' + job!.id).then(next => { if (!canceled) { void save({ ...next, title: job!.title, bodyReferenceId: job!.bodyReferenceId, scene: job!.scene, outfit: job!.outfit }); if (next.status === 'done') showToast('Your preview is ready', 'success'); } }).catch(() => { if (!canceled) { setError('Your preview may still be processing. Check progress before starting another.'); setJob(current => current ? { ...current, message: 'Check progress to reconnect' } : current); } }); }, 5000); return () => { canceled = true; clearTimeout(poll); }; }, [job, focused, ready]);
  async function check() { if (!ready || !job || locked.current) return; locked.current = true; setBusy(true); try { await save({ ...await studioRequest<StudioJob>('/tryon/' + job.id), title: job.title, bodyReferenceId: job.bodyReferenceId, scene: job.scene, outfit: job.outfit }); setError(''); } catch(e) { if (e instanceof StudioError && e.status === 404) await save({ ...job, status: 'failed', message: 'No preview was submitted. You can try again.' }); setError(e instanceof Error ? e.message : 'Could not check progress.'); } finally { locked.current = false; if (mounted.current) setBusy(false); } }
  async function create(photos: PersonReference[], products: Product[], title: string, scene: TryOnScene) {
    if (!hydrated || locked.current || jobRunning(job) || job?.status === 'unknown') return; locked.current = true; setBusy(true); setError('');
    const pending: StudioJob = { id: 'form-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,12), status: 'preparing', title, scene: {...scene}, outfit: products.map(p=>({id:p.id,name:p.name,slot:p.slot,priceCents:p.priceCents})), bodyReferenceId: photos.find(p => p.role === 'body')?.id, message: 'Preparing your references' };
    try { await save(pending); const result = await submitStudioPreview(pending.id, photos, products, pending.scene); await save({ ...result, title: pending.title, bodyReferenceId: pending.bodyReferenceId, scene: pending.scene, outfit: pending.outfit }); }
    catch(e) { const message = e instanceof Error ? e.message : 'Could not prepare your preview.'; setError(message); try { await save({ ...await studioRequest<StudioJob>('/tryon/' + pending.id), title: pending.title, bodyReferenceId: pending.bodyReferenceId, scene: pending.scene, outfit: pending.outfit }); } catch(checkError) { await save({ ...pending, status: checkError instanceof StudioError && checkError.status === 404 ? 'failed' : 'unknown', message: checkError instanceof StudioError && checkError.status === 404 ? 'No generation was submitted. Please try again.' : 'Check progress before starting another preview.' }); } }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  /** One retry for every problem: re-check a stuck job, otherwise reconnect. */
  function retry() { setError(''); if (job && (jobRunning(job) || job.status === 'unknown')) void check(); else void connect(); }
  return { job, ready, checked, hydrated, busy, error, health, running: jobRunning(job), create, retry };
}
