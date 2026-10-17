/** Logs go to stderr: stdout carries the MCP protocol in stdio mode. */
export function log(message: string): void {
  process.stderr.write(`[react-native-agentic-ai] ${message}\n`);
}
