export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const msg = (error as { response?: { data?: { message?: string | string[] } } })
      .response?.data?.message;
    // NestJS's ValidationPipe returns `message` as string[] on validation errors —
    // Alert.alert() crashes natively if given anything but a string.
    if (Array.isArray(msg)) {
      if (msg.length > 0) return msg.join('\n');
    } else if (msg) {
      return msg;
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
