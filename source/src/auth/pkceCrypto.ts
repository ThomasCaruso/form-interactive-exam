import { Platform } from 'react-native';
import * as NativeCrypto from 'expo-crypto';
/** Supply the two WebCrypto operations auth-js needs; never fall back to Math.random or plain PKCE on native. */
if (Platform.OS !== 'web') {
  const native = {
    getRandomValues: NativeCrypto.getRandomValues,
    randomUUID: NativeCrypto.randomUUID,
    subtle: { digest: (algorithm: string, data: BufferSource) => {
      if (algorithm !== 'SHA-256') throw new Error('Unsupported auth digest');
      return NativeCrypto.digest(NativeCrypto.CryptoDigestAlgorithm.SHA256, data);
    } },
  };
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: native, configurable: true });
  else {
    if (!globalThis.crypto.getRandomValues) Object.defineProperty(globalThis.crypto, 'getRandomValues', { value: native.getRandomValues, configurable: true });
    if (!globalThis.crypto.subtle) Object.defineProperty(globalThis.crypto, 'subtle', { value: native.subtle, configurable: true });
  }
}
