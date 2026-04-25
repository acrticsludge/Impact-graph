import { spawn } from 'node:child_process';

export async function openInBrowser(filePath: string): Promise<void> {
  const command = getOpenCommand(filePath);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.bin, command.args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

export function getOpenCommand(filePath: string): { bin: string; args: string[] } {
  if (process.platform === 'win32') return { bin: 'cmd', args: ['/c', 'start', '', filePath] };
  if (process.platform === 'darwin') return { bin: 'open', args: [filePath] };
  return { bin: 'xdg-open', args: [filePath] };
}
