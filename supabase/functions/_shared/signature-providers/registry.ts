import type { SignatureProvider } from './types.ts';
import { MciNativeSignatureProvider } from './mci-native.ts';

const providers: Record<string, SignatureProvider> = {
  mci_native: new MciNativeSignatureProvider(),
};

export function getSignatureProvider(name?: string | null): SignatureProvider {
  const key = (name ?? 'mci_native').toLowerCase();
  const provider = providers[key];
  if (!provider) throw new Error(`Provider de assinatura não suportado: ${key}`);
  return provider;
}
