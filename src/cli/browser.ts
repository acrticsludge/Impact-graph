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

export function getOpenCommand(pathOrUrl: string): { bin: string; args: string[] } {
  const isHttpUrl = pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://');
  if (process.platform === 'win32') {
    // PowerShell Start-Process reliably opens the default browser for both
    // file:// and http:// URLs. cmd "start" quoting is mangled by Node arg
    // escaping; rundll32 uses the .html extension handler (may be Notepad).
    const url = isHttpUrl ? pathOrUrl : 'file:///' + pathOrUrl.replace(/\\/g, '/');
    return { bin: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${url}'`] };
  }
  if (process.platform === 'darwin') return { bin: 'open', args: [pathOrUrl] };
  return { bin: 'xdg-open', args: [pathOrUrl] };
}
