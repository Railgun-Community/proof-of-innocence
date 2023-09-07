import { NetworkName } from '@railgun-community/shared-models';
import { AbstractDatabase } from '../abstract-database';
import { TestDBItem, CollectionName } from '../../models/database-types';
import { IndexDescription, WithId } from 'mongodb';

export class TestDatabase extends AbstractDatabase<TestDBItem> {
    constructor(networkName: NetworkName) {
        super(networkName, CollectionName.Test);
    }

    async createCollectionIndices() {
        await this.createIndex(['test'], { unique: true });
    }

    async getCollectionIndexes(): Promise<IndexDescription[]> {
        return this.listCollectionIndexes();
    }

    async getItem(filter: Partial<TestDBItem>): Promise<WithId<TestDBItem> | null | undefined> {
        return this.findOne(filter);
    }

    async insert(item: TestDBItem) { await this.insertOne(item); }

    async update(filter: Partial<TestDBItem>, item: Partial<TestDBItem>) { await this.updateOne(filter, item); }

    async delete(filter: Partial<TestDBItem>): Promise<void> {
        await this.deleteOne(filter);
    }
}