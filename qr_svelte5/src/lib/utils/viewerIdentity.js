// @ts-nocheck

export function normalizeHeadsetId(value) {
  const headsetId = String(value ?? '').trim();
  if (!/^\d+$/.test(headsetId)) return headsetId;
  return headsetId.replace(/^0+(?=\d)/, '');
}

export function formatHeadsetId(value) {
  const headsetId = normalizeHeadsetId(value);
  return /^[1-9]$/.test(headsetId) ? `0${headsetId}` : headsetId;
}

export function sameHeadsetId(first, second) {
  return normalizeHeadsetId(first) === normalizeHeadsetId(second);
}

export function normalizeViewerClient(client) {
  if (!client) return null;
  return {
    ...client,
    location: String(client.location ?? '').trim(),
    id: normalizeHeadsetId(client.id),
  };
}

export function formatViewerId(value) {
  const viewerId = String(value ?? '').trim();
  const separatorIndex = Math.max(viewerId.lastIndexOf('/'), viewerId.lastIndexOf(':'));
  if (separatorIndex < 0) return formatHeadsetId(viewerId);

  return `${viewerId.slice(0, separatorIndex + 1)}${formatHeadsetId(viewerId.slice(separatorIndex + 1))}`;
}
