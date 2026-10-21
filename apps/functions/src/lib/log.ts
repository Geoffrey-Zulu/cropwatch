// One JSON object per line: Cloud Logging reads `severity` and `message` and indexes the rest.
export function log(
  severity: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR',
  message: string,
  fields: Record<string, unknown> = {}
) {
  const line = JSON.stringify({ severity, message, ...fields })
  if (severity === 'ERROR') console.error(line)
  else console.log(line)
}

export function errorFields(error: unknown) {
  return error instanceof Error ? { error: error.message, stack: error.stack } : { error }
}
