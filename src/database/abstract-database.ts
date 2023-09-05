import { NetworkName, isDefined } from '@railgun-community/shared-models';
import debug from 'debug';
import {
  Collection,
  Db,
  MongoError,
  OptionalUnlessRequiredId,
  Document,
  Filter,
  Sort,
  IndexSpecification,
  CreateIndexesOptions,
  WithId,
} from 'mongodb';
import { DatabaseClient } from './database-client';
import { CollectionName } from '../models/database-types';
import { networkForName } from '../config/general';

export abstract class AbstractDatabase<T extends Document> {
  private db: Db;

  private collection: Collection<T>;

  private dbg: debug.Debugger;

  constructor(networkName: NetworkName, collection: CollectionName) {
    if (!DatabaseClient.client) {
      throw new Error('DatabaseClient not initialized');
    }

    const { chain } = networkForName(networkName);
    const chainKey = `${chain.type}:${chain.id}`;

    this.db = DatabaseClient.client.db(chainKey);
    this.collection = this.db.collection<T>(collection);

    this.dbg = debug(`poi:db:${collection}`);
  }

  protected async insertOne(data: OptionalUnlessRequiredId<T>): Promise<void> {
    try {
      await this.collection.insertOne(data);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.onInsertError(err);
    }
  }

  protected async updateOne(filter: Filter<T>, item: Partial<T>) {
    try {
      await this.collection.updateOne(filter, item);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.dbg(err.message);
      throw err;
    }
  }

  protected async findOne(filter: Filter<T>): Promise<Optional<WithId<T>>> {
    const options = { projection: { _id: 0 } };
    const item = await this.collection.findOne(filter, options);
    return item ?? undefined;
  }

  protected async findOneAndReplace(
    filter: Filter<T>,
    replacement: T,
  ): Promise<void> {
    const options = { upsert: true };
    await this.collection.findOneAndReplace(filter, replacement, options);
  }

  protected async findAll(
    max: Optional<Partial<T>>,
    filter: Optional<Filter<T>>,
    sort: Optional<Sort>,
  ): Promise<T[]> {
    let cursor = this.collection.find();
    if (isDefined(max)) {
      cursor = cursor.max(max);
    }
    if (isDefined(filter)) {
      cursor = cursor.filter(filter);
    }
    if (isDefined(sort)) {
      cursor = cursor.sort(sort);
    }
    return cursor.project({ _id: 0 }).toArray() as Promise<T[]>;
  }

  async createIndex(
    indexSpec: IndexSpecification,
    options?: CreateIndexesOptions,
  ) {
    return this.collection.createIndex(indexSpec, options);
  }

  private onInsertError(err: MongoError) {
    if (err?.code === 11000) {
      this.dbg(err.message);
      // ignore duplicate key error
      return;
    }
    this.dbg(err.message);
    throw err;
  }
}