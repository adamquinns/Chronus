import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { Campaign, TurnAudit } from './domain';
import { validateWorld } from './state';

interface ChronusDb extends DBSchema {
  campaigns: {
    key: string;
    value: { id: string; updatedAt: string; campaign: Campaign };
    indexes: { 'by-updated': string };
  };
  audits: {
    key: string;
    value: TurnAudit;
    indexes: { 'by-campaign': string; 'by-turn': number };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<ChronusDb>> | undefined;

const database = () => {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is unavailable in this environment.');
  dbPromise ??= openDB<ChronusDb>('chronus-causal-simulation', 1, {
    upgrade(db) {
      const campaigns = db.createObjectStore('campaigns', { keyPath: 'id' });
      campaigns.createIndex('by-updated', 'updatedAt');
      const audits = db.createObjectStore('audits', { keyPath: 'id' });
      audits.createIndex('by-campaign', 'campaignId');
      audits.createIndex('by-turn', 'turn');
      db.createObjectStore('settings', { keyPath: 'key' });
    },
  });
  return dbPromise;
};

export const saveCampaign = async (campaign: Campaign) => {
  const issues = validateWorld(campaign.state).filter((issue) => issue.severity === 'ERROR');
  if (issues.length) throw new Error(`Refusing to persist invalid world state: ${issues[0].message}`);
  const db = await database();
  const transaction = db.transaction(['campaigns', 'audits'], 'readwrite');
  await transaction.objectStore('campaigns').put({
    id: campaign.state.campaignId,
    updatedAt: new Date().toISOString(),
    campaign,
  });
  for (const audit of campaign.audits) await transaction.objectStore('audits').put(audit);
  await transaction.done;
};

export const loadCampaign = async (campaignId: string): Promise<Campaign | undefined> => {
  const record = await (await database()).get('campaigns', campaignId);
  return record?.campaign;
};

export const loadMostRecentCampaign = async (): Promise<Campaign | undefined> => {
  const db = await database();
  const cursor = await db.transaction('campaigns').store.index('by-updated').openCursor(null, 'prev');
  return cursor?.value.campaign;
};

export const listCampaigns = async () => {
  const records = await (await database()).getAll('campaigns');
  return records
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((record) => ({
      id: record.id,
      title: record.campaign.state.manifest.title,
      turn: record.campaign.state.turn,
      dateLabel: record.campaign.state.dateLabel,
      updatedAt: record.updatedAt,
    }));
};

export const deleteCampaign = async (campaignId: string) => {
  const db = await database();
  const transaction = db.transaction(['campaigns', 'audits'], 'readwrite');
  await transaction.objectStore('campaigns').delete(campaignId);
  const index = transaction.objectStore('audits').index('by-campaign');
  let cursor = await index.openCursor(campaignId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await transaction.done;
};

export const exportCampaign = (campaign: Campaign) => JSON.stringify({
  format: 'chronus-campaign',
  version: 1,
  exportedAt: new Date().toISOString(),
  campaign,
}, null, 2);

export const importCampaign = (raw: string): Campaign => {
  const parsed = JSON.parse(raw) as { format?: string; version?: number; campaign?: Campaign };
  if (parsed.format !== 'chronus-campaign' || parsed.version !== 1 || !parsed.campaign?.state) {
    throw new Error('Unsupported or malformed Chronus campaign file.');
  }
  const issues = validateWorld(parsed.campaign.state).filter((issue) => issue.severity === 'ERROR');
  if (issues.length) throw new Error(`Campaign validation failed: ${issues[0].message}`);
  return parsed.campaign;
};

export const setSetting = async (key: string, value: unknown) => (await database()).put('settings', { key, value });
export const getSetting = async <T>(key: string): Promise<T | undefined> => (await database()).get('settings', key).then((record) => record?.value as T | undefined);
