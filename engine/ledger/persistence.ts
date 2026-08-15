import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { hashLedger } from './ledger';
import { Ledger, TurnRecord } from './types';

export interface Campaign {
  ledger: Ledger;
  records: TurnRecord[];
}

interface ChronusLedgerDb extends DBSchema {
  campaigns: {
    key: string;
    value: { id: string; updatedAt: string; campaign: Campaign };
    indexes: { 'by-updated': string };
  };
  settings: { key: string; value: { key: string; value: unknown } };
}

let dbPromise: Promise<IDBPDatabase<ChronusLedgerDb>> | undefined;

const database = () => {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is unavailable in this environment.');
  dbPromise ??= openDB<ChronusLedgerDb>('chronus-ledger', 1, {
    upgrade(db) {
      const campaigns = db.createObjectStore('campaigns', { keyPath: 'id' });
      campaigns.createIndex('by-updated', 'updatedAt');
      db.createObjectStore('settings', { keyPath: 'key' });
    },
  });
  return dbPromise;
};

export const saveCampaign = async (campaign: Campaign) => {
  const db = await database();
  await db.put('campaigns', {
    id: campaign.ledger.campaignId,
    updatedAt: new Date().toISOString(),
    campaign,
  });
};

export const loadCampaign = async (id: string): Promise<Campaign | undefined> =>
  (await (await database()).get('campaigns', id))?.campaign;

export const listCampaigns = async () => {
  const records = await (await database()).getAll('campaigns');
  return records
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((record) => ({
      id: record.id,
      title: record.campaign.ledger.scenarioId,
      turn: record.campaign.ledger.turn,
      dateLabel: record.campaign.ledger.date,
      updatedAt: record.updatedAt,
    }));
};

export const deleteCampaign = async (id: string) => (await database()).delete('campaigns', id);

export const exportCampaign = (campaign: Campaign) => JSON.stringify({
  format: 'chronus-ledger',
  version: 1,
  exportedAt: new Date().toISOString(),
  campaign,
}, null, 2);

export const importCampaign = (raw: string): Campaign => {
  const parsed = JSON.parse(raw) as { format?: string; version?: number; campaign?: Campaign };
  if (parsed.format !== 'chronus-ledger' || parsed.version !== 1 || !parsed.campaign?.ledger) {
    throw new Error('Unsupported or malformed Chronus ledger file.');
  }
  return parsed.campaign;
};

/**
 * Rewind to the state committed at a given turn. The record carries hashed
 * snapshots, so this restores exactly rather than replaying.
 */
export const rollback = (campaign: Campaign, toTurn: number): Campaign => {
  if (toTurn === 0) {
    const first = campaign.records[0];
    if (!first) throw new Error('Nothing to roll back to.');
    if (hashLedger(first.ledgerBefore) !== first.ledgerBeforeHash) throw new Error('Prior ledger hash mismatch.');
    return { ledger: structuredClone(first.ledgerBefore), records: [] };
  }
  const record = campaign.records.find((candidate) => candidate.turn === toTurn);
  if (!record) throw new Error(`No committed record for turn ${toTurn}.`);
  if (hashLedger(record.ledgerAfter) !== record.ledgerAfterHash) throw new Error('Committed ledger hash mismatch.');
  return {
    ledger: structuredClone(record.ledgerAfter),
    records: campaign.records.filter((candidate) => candidate.turn <= toTurn),
  };
};

export const setSetting = async (key: string, value: unknown) => (await database()).put('settings', { key, value });
export const getSetting = async <T>(key: string): Promise<T | undefined> =>
  (await database()).get('settings', key).then((record) => record?.value as T | undefined);
