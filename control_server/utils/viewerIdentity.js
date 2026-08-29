export const normalizeHeadsetId = (value) => {
  const headsetId = String(value ?? '').trim();
  if (!/^\d+$/.test(headsetId)) return headsetId;

  // Keep identifiers as strings. Number.parseInt() would collapse distinct
  // values above Number.MAX_SAFE_INTEGER, while removing leading zeroes is
  // sufficient for identity matching.
  return headsetId.replace(/^0+(?=\d)/, '');
};

export const formatHeadsetId = (value) => {
  const headsetId = normalizeHeadsetId(value);
  return /^[1-9]$/.test(headsetId) ? `0${headsetId}` : headsetId;
};

export const sameHeadsetId = (first, second) => (
  normalizeHeadsetId(first) === normalizeHeadsetId(second)
);

export const buildViewerId = (location, headsetId) => (
  `${String(location ?? '').trim()}/${normalizeHeadsetId(headsetId)}`
);
