// @ts-nocheck

import { getSubfolder } from '$lib/utils/+helpers.svelte';

export function getViewerBasePath(client) {
  const location = client?.location;
  const id = client?.id;

  if (!location || !id) return getSubfolder();

  return `${getSubfolder()}/${encodeURIComponent(location)}/${encodeURIComponent(id)}`;
}

export function getViewerRoute(client, section, routeId = null) {
  const basePath = getViewerBasePath(client);
  const sectionPath = encodeURIComponent(section);

  return routeId === null || routeId === undefined
    ? `${basePath}/${sectionPath}`
    : `${basePath}/${sectionPath}/${encodeURIComponent(routeId)}`;
}
