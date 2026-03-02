export interface DesktopFilePayload {
  path: string;
  base64: string;
}

interface TauriCore {
  invoke: (command: string, payload?: Record<string, unknown>) => Promise<unknown>;
}

interface TauriGlobal {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: {
    core?: TauriCore;
  };
}

const toBase64 = async (blob: Blob): Promise<string> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to serialize blob as base64 data URL.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed.'));
    reader.readAsDataURL(blob);
  });

  const [, payload = ''] = dataUrl.split(',');
  return payload;
};

const getTauriCore = (): TauriCore | null => {
  const runtime = window as Window & TauriGlobal;
  return runtime.__TAURI__?.core ?? null;
};

export const isDesktopRuntime = (): boolean => Boolean(getTauriCore());

export const exportToDesktop = async (files: Array<{ path: string; blob: Blob }>): Promise<boolean> => {
  const core = getTauriCore();
  if (!core) return false;

  const payload: DesktopFilePayload[] = [];

  for (const file of files) {
    payload.push({
      path: file.path,
      base64: await toBase64(file.blob)
    });
  }

  await core.invoke('save_generated_files', { files: payload });
  return true;
};
