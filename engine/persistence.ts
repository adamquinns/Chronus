import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { Campaign, TurnAudit } from './domain';
import { validateWorld } from './state';
import { assertValidScenario, migrateCampaign } from './scenario';

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
  assertValidScenario(campaign);
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
  if (!record) return undefined;
  const campaign = migrateCampaign(record.campaign);
  assertValidScenario(campaign);
  return campaign;
};

export const loadMostRecentCampaign = async (): Promise<Campaign | undefined> => {
  const db = await database();
  const cursor = await db.transaction('campaigns').store.index('by-updated').openCursor(null, 'prev');
  if (!cursor) return undefined;
  const campaign = migrateCampaign(cursor.value.campaign);
  assertValidScenario(campaign);
  return campaign;
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
  version: 2,
  exportedAt: new Date().toISOString(),
  campaign,
}, null, 2);

export const importCampaign = (raw: string): Campaign => {
  const parsed = JSON.parse(raw) as { format?: string; version?: number; campaign?: Campaign };
  if (parsed.format !== 'chronus-campaign' || ![1, 2].includes(parsed.version ?? 0) || !parsed.campaign?.state) {
    throw new Error('Unsupported or malformed Chronus campaign file.');
  }
  const campaign = migrateCampaign(parsed.campaign);
  assertValidScenario(campaign);
  const issues = validateWorld(campaign.state).filter((issue) => issue.severity === 'ERROR');
  if (issues.length) throw new Error(`Campaign validation failed: ${issues[0].message}`);
  return campaign;
};

export const rollbackCampaign = (campaign: Campaign, committedTurn: number): Campaign => {
  if (committedTurn === 0) {
    const first = campaign.audits[0];
    if (!first || first.legacyIncomplete) throw new Error('No exact initial snapshot is available for rollback.');
    return {
      state: structuredClone(first.previousStateSnapshot),
      beliefs: structuredClone(first.previousBeliefSnapshot),
      memories: structuredClone(first.previousMemorySnapshot),
      audits: [],
      storySummary: '',
      narrativeCharacters: [],
      narrativeThreads: [],
      chronicle: [],
    };
  }
  const audit = campaign.audits.find((candidate) => candidate.turn === committedTurn);
  if (!audit || audit.legacyIncomplete) throw new Error(`No exact audit snapshot is available for turn ${committedTurn}.`);
  return {
    state: structuredClone(audit.committedStateSnapshot),
    beliefs: structuredClone(audit.committedBeliefSnapshot),
    memories: structuredClone(audit.committedMemorySnapshot),
    audits: campaign.audits.filter((candidate) => candidate.turn <= committedTurn),
    storySummary: audit.narrative.updatedStorySummary || campaign.storySummary,
    narrativeCharacters: campaign.narrativeCharacters.filter((character) => character.introducedTurn <= committedTurn),
    narrativeThreads: campaign.narrativeThreads.filter((thread) => thread.updatedTurn <= committedTurn),
    chronicle: campaign.chronicle.filter((entry) => entry.turn <= committedTurn),
  };
};

export const setSetting = async (key: string, value: unknown) => (await database()).put('settings', { key, value });
export const getSetting = async <T>(key: string): Promise<T | undefined> => (await database()).get('settings', key).then((record) => record?.value as T | undefined);
