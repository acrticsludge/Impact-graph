#!/usr/bin/env node
/**
 * Kills any process listening on the impact-graph dev server port (51789)
 * before the test suite runs, so tests always get a fresh server.
 */
import { execSync } from 'node:child_process';

const PORT = process.env['IMPACT_GRAPH_PORT'] ?? '51789';

try {
  if (process.platform === 'win32') {
    const out = execSync(`netstat -ano`, { encoding: 'utf-8' });
    const match = out.match(new RegExp(`127\\.0\\.0\\.1:${PORT}\\s+\\S+\\s+LISTENING\\s+(\\d+)`));
    if (match) {
      execSync(`taskkill /F /PID ${match[1]}`, { stdio: 'ignore' });
      console.log(`[pretest] Killed PID ${match[1]} on port ${PORT}`);
    }
  } else {
    execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' });
  }
} catch {
  // Nothing to kill — that's fine
}
