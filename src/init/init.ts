import debug from 'debug';
import { startEngine, stopEngine } from '../engine/engine-init';
import { initNetworkProviders } from '../rpc-providers/active-network-providers';
import { setOnMerkletreeScanCallback } from '@railgun-community/wallet';
import { onMerkletreeScanCallback } from '../status/merkletree-scan-callback';
import { DatabaseClient } from '../database/database-client';

const dbg = debug('poi:init');

export const initModules = async () => {
  startEngine();
  await initNetworkProviders();
  await DatabaseClient.init();
  setOnMerkletreeScanCallback(onMerkletreeScanCallback);
  dbg('Node init successful.');
};

export const uninitModules = async () => {
  await stopEngine();
};