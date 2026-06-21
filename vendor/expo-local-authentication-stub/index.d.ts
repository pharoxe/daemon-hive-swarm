export type LocalAuthenticationResult = { success: boolean; error?: string; warning?: string };

export function hasHardwareAsync(): Promise<boolean>;
export function isEnrolledAsync(): Promise<boolean>;
export function authenticateAsync(options?: {
  promptMessage?: string;
  cancelLabel?: string;
  disableDeviceFallback?: boolean;
}): Promise<LocalAuthenticationResult>;
