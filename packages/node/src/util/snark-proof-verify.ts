import { TransactProofData } from '@railgun-community/shared-models';
import { getProver } from '@railgun-community/wallet';

export const verifyTransactProof = async (
  transactProofData: TransactProofData,
): Promise<boolean> => {
  // Mini
  if (await tryVerifyProof(transactProofData, 3, 3)) {
    return true;
  }
  // Full
  return tryVerifyProof(transactProofData, 13, 13);
};

const getPublicInputsPOI = (
  transactProofData: TransactProofData,
  maxInputs: number,
  maxOutputs: number,
) => {
  const prover = getProver();
  return prover.getPublicInputsPOI(
    transactProofData.txidMerkleroot,
    transactProofData.blindedCommitmentsOut,
    transactProofData.poiMerkleroots,
    transactProofData.railgunTxidIfHasUnshield,
    maxInputs,
    maxOutputs,
  );
};

const tryVerifyProof = async (
  transactProofData: TransactProofData,
  maxInputs: number,
  maxOutputs: number,
) => {
  try {
    const prover = getProver();
    const publicInputs = getPublicInputsPOI(
      transactProofData,
      maxInputs,
      maxOutputs,
    );
    return await prover.verifyPOIProof(
      publicInputs,
      transactProofData.snarkProof,
      maxInputs,
      maxOutputs,
    );
  } catch (err) {
    return false;
  }
};
