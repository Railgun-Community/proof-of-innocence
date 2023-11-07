import {
  isDefined,
  NETWORK_CONFIG,
  NetworkName,
} from '@railgun-community/shared-models';
import { getRailgunTxidsForUnshields } from '@railgun-community/wallet';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FullScreenSpinner } from '@components/FullScreenSpinner/FullScreenSpinner';
import { List } from '@screens/NodeStatus/components/List/List';
import { useNodeStore } from '@state/stores';
import styles from '../NodeStatus/NodeStatus.module.scss';
import { POIStatusDisplay } from '@components/POIStatusDisplay/POIStatusDisplay';

export const Explorer = () => {
  // useState()
  const [queryInput, setQueryInput] = useState(
    '0xe523c6f891ff980f766005b9afcc16adc7607201db6ce8621ed753bed2eb16ea',
  );
  const {
    getNodeStatusForAllNetworks,
    getPOIsPerList,
    nodeStatusForAllNetworks,
    loadingNodeStatusForAllNetworks,
    currentNetwork,
    poisPerList,
  } = useNodeStore();

  const nodeStatusForCurrentNetwork = useMemo(
    () => nodeStatusForAllNetworks?.forNetwork[currentNetwork],
    [currentNetwork, nodeStatusForAllNetworks?.forNetwork],
  );
  const listKeys = useMemo(
    () => nodeStatusForAllNetworks?.listKeys,
    [nodeStatusForAllNetworks],
  );

  useEffect(() => {
    if (!isDefined(nodeStatusForAllNetworks)) {
      getNodeStatusForAllNetworks();
    }
  }, [getNodeStatusForAllNetworks, nodeStatusForAllNetworks]);

  const handleQuery = async (input: string) => {
    console.log(input);
    console.log('query');
    if (!listKeys) return;
    const railgunTxids = await getRailgunTxidsForUnshields(
      NETWORK_CONFIG[currentNetwork].chain,
      input,
    );
    console.log(railgunTxids);
    if (railgunTxids.length === 0) {
      console.log('no transactions');
    }
    const data = await getPOIsPerList(listKeys, railgunTxids);
    console.log(data);
  };

  if (loadingNodeStatusForAllNetworks) {
    return <FullScreenSpinner />;
  }

  return (
    <div className={styles.nodeStatusContainer}>
      <input
        type="text"
        value={queryInput}
        onChange={e => setQueryInput(e.target.value)}
      />
      <button onClick={() => handleQuery(queryInput)}>Search</button>
      {poisPerList && <POIStatusDisplay poisPerListMap={poisPerList} />}
    </div>
  );
};