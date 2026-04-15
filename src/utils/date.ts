export function formatDateBr(d?: Date | string | null): string {
  if (d == null) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function formatDurationMs(ms: number): string {
  const n = ms < 0 ? 0 : ms;
  const totalSec = Math.floor(n / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}min`;
  }
  if (mins > 0) {
    return `${mins}min`;
  }
  return `${secs}s`;
}

/**
 * Duração da execução: de "Dar partida" até concluir (ou parcial se em andamento).
 */
export function formatWorkOrderDeliveryDuration(
  startedAt: Date | string | undefined | null,
  completedAt: Date | string | undefined | null,
  status: string,
): string | null {
  if (!startedAt) return null;
  const start = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  if (status === 'DONE' && completedAt) {
    const end = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
    return formatDurationMs(end.getTime() - start.getTime());
  }
  if (status === 'IN_PROGRESS') {
    return formatDurationMs(Date.now() - start.getTime());
  }
  return null;
}
