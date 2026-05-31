import { File, Paths } from 'expo-file-system';

const logFile = new File(Paths.document, 'ai-agent-debug.log');

export function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;

  try {
    if (logFile.exists) {
      // Append by reading existing + writing all
      const existing = logFile.text() as unknown as string;
      logFile.write(existing + line);
    } else {
      logFile.write(line);
    }
  } catch (e) {
    console.error('FileLogger write failed:', e);
  }
}

export function readLogs(): string {
  try {
    if (!logFile.exists) return '(no logs yet)';
    return logFile.text() as unknown as string;
  } catch {
    return '(error reading logs)';
  }
}

export function clearLogs() {
  try {
    if (logFile.exists) logFile.delete();
  } catch {}
}

export function getLogPath(): string {
  return logFile.uri;
}
