import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBMaxMin,
  DBSort,
  POIOrderedEventDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { POIEvent } from '../../models/poi-types';

export class POIOrderedEventsDatabase extends AbstractDatabase<POIOrderedEventDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.POIOrderedEvents);
  }

  async createCollectionIndices() {
    await this.createIndex(['index'], { unique: true });
  }

  async insertValidPOIEvent(poiEvent: POIEvent): Promise<void> {
    const { blindedCommitments, proof, signature } = poiEvent;
    const index = (await this.countPOIEvents()) + 1;
    const item: POIOrderedEventDBItem = {
      index,
      blindedCommitments,
      proof,
      signature,
    };
    await this.insertOne(item);
  }

  async getPOIEvents(startingIndex: number) {
    const min: DBMaxMin<POIOrderedEventDBItem> = {
      index: startingIndex,
    };
    const sort: DBSort<POIOrderedEventDBItem> = {
      index: 'ascending',
    };
    return this.findAll(
      undefined, // filter
      sort,
      undefined, // max
      min,
    );
  }

  private async countPOIEvents(): Promise<number> {
    return this.count();
  }
}
