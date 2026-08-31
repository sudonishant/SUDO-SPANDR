const decoderLabel = (encoding = 'utf-8') => {
  const normalized = String(encoding).toLowerCase().replace(/[_ ]/g, '-');
  if (normalized === 'unicode' || normalized === 'utf16le' || normalized === 'utf-16') return 'utf-16le';
  if (normalized === 'ucs2' || normalized === 'ucs-2') return 'utf-16le';
  if (normalized === 'us-ascii') return 'utf-8';
  return normalized;
};

export function decode(input, encoding = 'utf-8') {
  return new TextDecoder(decoderLabel(encoding), { fatal: false }).decode(input instanceof Uint8Array ? input : new Uint8Array(input));
}

export function encode(value, encoding = 'utf-8') {
  const normalized = decoderLabel(encoding);
  if (normalized === 'utf-16le') {
    const result = new Uint8Array(String(value).length * 2);
    for (let index = 0; index < String(value).length; index += 1) {
      const code = String(value).charCodeAt(index);
      result[index * 2] = code & 0xff;
      result[index * 2 + 1] = code >> 8;
    }
    return result;
  }
  return new TextEncoder().encode(String(value));
}

export default { decode, encode };
