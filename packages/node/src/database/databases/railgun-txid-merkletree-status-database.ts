import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  RailgunTxidMerkletreeStatusDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';

export class RailgunTxidMerkletreeStatusDatabase extends AbstractDatabase<RailgunTxidMerkletreeStatusDBItem> {
  constructor(networkName: NetworkName, txidVersion: TXIDVersion) {
    super(networkName, txidVersion, CollectionName.RailgunTxidMerkletreeStatus);
  }

  async createCollectionIndices() {
    // No index
    await this.createIndex([], {});
  }

  async getStatus(): Promise<Optional<RailgunTxidMerkletreeStatusDBItem>> {
    const filter: DBFilter<RailgunTxidMerkletreeStatusDBItem> = {};
    return this.findOne(filter);
  }

  async saveValidatedTxidStatus(
    validatedTxidIndex: number,
    validatedTxidMerkleroot: string,
  ): Promise<void> {
    const filter: DBFilter<RailgunTxidMerkletreeStatusDBItem> = {};
    const replacement: RailgunTxidMerkletreeStatusDBItem = {
      validatedTxidIndex,
      validatedTxidMerkleroot,
    };
    await this.upsertOne(filter, replacement);
  }

  async clearValidatedTxidStatus(): Promise<void> {
    const filter: DBFilter<RailgunTxidMerkletreeStatusDBItem> = {};
    await this.deleteOne(filter);
  }
}
