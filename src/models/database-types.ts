import { SortDirection } from 'mongodb';
import { SerializedSnarkProof } from './general-types';

export type DBMaxMin<T> = Partial<T>;

export type DBFilter<T> = Partial<T>;

export type DBSort<T> = Partial<Record<keyof T, SortDirection>>;

export type DBIndexSpec<T> = (keyof T)[];

export type DBOptional<T> = Optional<T> | null;

export enum CollectionName {
  // General
  Status = 'Status',

  // Pending shields
  ShieldQueue = 'ShieldQueue',

  // Proof mempools
  ShieldProofMempool = 'ShieldProofMempool',
  TransactProofPerListMempool = 'TransactProofPerListMempool',

  // POI databases
  POIOrderedEvents = 'POIOrderedEvents',
  POIMerkletree = 'POIMerkletree',
  POIHistoricalMerkleroots = 'POIHistoricalMerkleroots',
}

export enum ShieldStatus {
  // Waiting for validation
  Pending = 'Pending',

  // Validation statuses
  Allowed = 'Allowed',
  Blocked = 'Blocked',

  // POI status
  AddedPOI = 'AddedPOI',
}

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type ShieldQueueDBItem = {
  txid: string;
  hash: string;
  timestamp: number;
  status: ShieldStatus;
  lastValidatedTimestamp: DBOptional<number>;
};

export type StatusDBItem = {
  latestBlockScanned: number;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type ShieldProofMempoolDBItem = {
  snarkProof: SerializedSnarkProof;
  commitmentHash: string;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type TransactProofMempoolDBItem = {
  snarkProof: SerializedSnarkProof;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type POIOrderedEventDBItem = {
  listKey: string;
  index: number;
  blindedCommitments: string[];
  proof: SerializedSnarkProof;
  signature: string;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type POIMerkletreeDBItem = {
  listKey: string;
  tree: number;
  level: number;
  index: number;
  nodeHash: string;
};

// DO NOT CHANGE FIELDS WITHOUT CLEARING OR MIGRATING THE DB.
export type POIHistoricalMerklerootDBItem = {
  listKey: string;
  rootHash: string;
};
