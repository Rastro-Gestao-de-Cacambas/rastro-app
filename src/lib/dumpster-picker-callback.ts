/**
 * Lightweight callback store used to pass the selected dumpster back from
 * the DumpsterPickerScreen to WorkOrderDetailScreen without needing a global
 * state library or complex navigation params.
 *
 * Usage:
 *   // caller registers before navigating
 *   registerPickerCallback((id, code) => { ... });
 *   router.push('/dumpster-picker');
 *
 *   // picker calls this after the user taps a dumpster
 *   invokePickerCallback(dumpster.id, dumpster.code);
 *   router.back();
 */

type PickerCallback = (dumpsterId: string, dumpsterCode: string) => void;

let _callback: PickerCallback | null = null;

export function registerPickerCallback(cb: PickerCallback): void {
  _callback = cb;
}

export function invokePickerCallback(dumpsterId: string, dumpsterCode: string): void {
  _callback?.(dumpsterId, dumpsterCode);
  _callback = null;
}

export function clearPickerCallback(): void {
  _callback = null;
}
