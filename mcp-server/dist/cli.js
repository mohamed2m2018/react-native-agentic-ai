#!/usr/bin/env node
import { main } from './index.js';
main().catch((err) => {
    process.stderr.write(`[mobileai-mcp] Fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
});
