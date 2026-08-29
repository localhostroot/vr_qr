import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { normalizeHeadsetId } from '../utils/viewerIdentity.js';

const timestampValue = (value) => {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const latestTimestamp = (...values) => values
  .filter(Boolean)
  .sort((first, second) => timestampValue(second) - timestampValue(first))[0] || null;

const mergePresenceRecord = (first, second) => {
  if (!first) return second;
  const latest = timestampValue(second.lastSeenAt) >= timestampValue(first.lastSeenAt)
    ? second
    : first;

  return {
    ...latest,
    id: normalizeHeadsetId(latest.id),
    lastSeenAt: latestTimestamp(first.lastSeenAt, second.lastSeenAt),
    lastSeenInServiceWindowAt: latestTimestamp(
      first.lastSeenInServiceWindowAt,
      second.lastSeenInServiceWindowAt,
    ),
    offlineSince: latest.offlineSince || latest.lastSeenAt || null,
  };
};

export const migratePresenceRecords = (records) => {
  if (!Array.isArray(records)) throw new Error('presence history must be an array');

  const merged = new Map();
  const aliases = new Map();
  for (const record of records) {
    if (!record?.location || !record?.id) continue;
    const id = normalizeHeadsetId(record.id);
    const key = `${record.location}:${id}`;
    const normalized = { ...record, id };
    merged.set(key, mergePresenceRecord(merged.get(key), normalized));

    if (!aliases.has(key)) aliases.set(key, new Set());
    aliases.get(key).add(String(record.id));
  }

  const aliasGroups = [...aliases.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([key, values]) => ({ key, aliases: [...values].sort() }));

  return {
    data: [...merged.values()],
    summary: {
      before: records.length,
      after: merged.size,
      merged: records.length - merged.size,
      aliasGroups,
    },
  };
};

export const migrateUptimeRecords = (records) => {
  if (!records || Array.isArray(records) || typeof records !== 'object') {
    throw new Error('uptime history must be an object');
  }

  const merged = {};
  const aliases = new Map();
  for (const [key, values] of Object.entries(records)) {
    if (!Array.isArray(values)) throw new Error(`uptime entry ${key} must be an array`);
    const separator = key.lastIndexOf('_');
    const location = separator >= 0 ? key.slice(0, separator) : '';
    const rawId = separator >= 0 ? key.slice(separator + 1) : '';
    const canonicalKey = location && /^\d+$/.test(rawId)
      ? `${location}_${normalizeHeadsetId(rawId)}`
      : key;

    merged[canonicalKey] = [...(merged[canonicalKey] || []), ...values];
    if (!aliases.has(canonicalKey)) aliases.set(canonicalKey, new Set());
    aliases.get(canonicalKey).add(key);
  }

  const aliasGroups = [...aliases.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([key, values]) => ({ key, aliases: [...values].sort() }));

  return {
    data: merged,
    summary: {
      before: Object.keys(records).length,
      after: Object.keys(merged).length,
      merged: Object.keys(records).length - Object.keys(merged).length,
      valuesBefore: Object.values(records).reduce((sum, values) => sum + values.length, 0),
      valuesAfter: Object.values(merged).reduce((sum, values) => sum + values.length, 0),
      aliasGroups,
    },
  };
};

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const writeWithBackup = async (filePath, value, stamp) => {
  const absolutePath = path.resolve(filePath);
  const backupPath = `${absolutePath}.before-headset-identity-${stamp}.bak`;
  const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
  const stat = await fs.stat(absolutePath);

  await fs.copyFile(absolutePath, backupPath, fsConstants.COPYFILE_EXCL);
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      mode: stat.mode,
    });
    await fs.rename(temporaryPath, absolutePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }

  return backupPath;
};

const parseArguments = (argumentsList) => {
  const options = {
    apply: false,
    presence: path.join(process.cwd(), 'presence-history.json'),
    uptime: path.join(process.cwd(), 'uptime.json'),
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--apply') options.apply = true;
    else if (argument === '--presence') options.presence = argumentsList[++index];
    else if (argument === '--uptime') options.uptime = argumentsList[++index];
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const presence = migratePresenceRecords(await readJson(options.presence));
  const uptime = migrateUptimeRecords(await readJson(options.uptime));
  const result = {
    mode: options.apply ? 'apply' : 'dry-run',
    presence: presence.summary,
    uptime: uptime.summary,
    backups: {},
  };

  if (options.apply) {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    result.backups.presence = await writeWithBackup(options.presence, presence.data, stamp);
    result.backups.uptime = await writeWithBackup(options.uptime, uptime.data, stamp);
  }

  console.log(JSON.stringify(result, null, 2));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
