export const normalizeHeadsetId = (value) => {
  const headsetId = String(value ?? '').trim();
  return /^\d+$/.test(headsetId)
    ? String(Number.parseInt(headsetId, 10))
    : headsetId;
};

export const sameHeadsetId = (first, second) => (
  normalizeHeadsetId(first) === normalizeHeadsetId(second)
);

export const buildViewerId = (location, headsetId) => (
  `${String(location ?? '').trim()}/${normalizeHeadsetId(headsetId)}`
);
