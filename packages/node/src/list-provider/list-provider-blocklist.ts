import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { BlockedShieldsPerListDatabase } from '../database/databases/blocked-shields-per-list-database';
import { ShieldQueueDBItem } from '../models/database-types';
import { signBlockedShield } from '../util/ed25519';
import { SignedBlockedShield } from '../models/poi-types';

export class ListProviderBlocklist {
  private static listKey: string;

  static init(listKey: string) {
    this.listKey = listKey;
  }

  static async addBlockedShield(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    shieldDBItem: ShieldQueueDBItem,
    blockReason: Optional<string>,
  ): Promise<void> {
    const db = new BlockedShieldsPerListDatabase(networkName, txidVersion);

    const signature = await signBlockedShield(
      shieldDBItem.commitmentHash,
      shieldDBItem.blindedCommitment,
      blockReason,
    );
    const signedBlockedShield: SignedBlockedShield = {
      commitmentHash: shieldDBItem.commitmentHash,
      blindedCommitment: shieldDBItem.blindedCommitment,
      blockReason,
      signature,
    };

    await db.insertSignedBlockedShield(this.listKey, signedBlockedShield);
  }
}
