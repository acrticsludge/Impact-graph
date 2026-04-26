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
  if (process.platform === 'win32') {
    // PowerShell Start-Process with a file:// URL reliably opens the default
    // browser. cmd "start" quoting is mangled by Node's arg escaping when
    // spawned without shell:true; rundll32 FileProtocolHandler uses the .html
    // file-extension association which may be Notepad on some systems.
    const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
    return { bin: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${fileUrl}'`] };
  }
  if (process.platform === 'darwin') return { bin: 'open', args: [filePath] };
  return { bin: 'xdg-open', args: [filePath] };
}
