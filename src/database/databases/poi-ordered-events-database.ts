import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  DBMaxMin,
  DBSort,
  POIOrderedEventDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { SignedPOIEvent } from '../../models/poi-types';
import { IndexDescription } from 'mongodb';

export class POIOrderedEventsDatabase extends AbstractDatabase<POIOrderedEventDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.POIOrderedEvents);
  }

  async createCollectionIndices() {
    await this.createIndex(['index', 'listKey'], { unique: true });
    await this.createIndex(['index']);
  }

  async getCollectionIndexes(): Promise<IndexDescription[]> {
    return this.listCollectionIndexes();
  }

  async insertValidSignedPOIEvent(
    listKey: string,
    signedPOIEvent: SignedPOIEvent,
  ): Promise<void> {
    const { index, blindedCommitments, proof, signature } = signedPOIEvent;
    const item: POIOrderedEventDBItem = {
      listKey,
      index,
      blindedCommitments,
      proof,
      signature,
    };
    await this.insertOne(item);
  }

  async getPOIEvents(
    listKey: string,
    startIndex: number,
    endIndex?: number,
  ): Promise<POIOrderedEventDBItem[]> {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
    };
    const sort: DBSort<POIOrderedEventDBItem> = {
      index: 'ascending',
    };

    // Set startIndex as the min index
    const min: DBMaxMin<POIOrderedEventDBItem> = {
      index: startIndex,
    };

    // If endIndex is defined, set it as the max index
    const max: DBMaxMin<POIOrderedEventDBItem> = {};
    if (typeof endIndex !== 'undefined') { max.index = endIndex; }

    return this.findAll(filter, sort, max, min);
  }

  async getCount(listKey: string): Promise<number> {
    const filter: DBFilter<POIOrderedEventDBItem> = {
      listKey,
    };
    return this.count(filter);
  }
}
