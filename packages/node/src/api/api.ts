import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import os from 'os';
import debug from 'debug';
import { Server } from 'http';
import {
  Validator,
  ValidationError,
  AllowedSchema,
} from 'express-json-validator-middleware';
import { POIEventList } from '../poi-events/poi-event-list';
import { networkNameForSerializedChain } from '../config/general';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { QueryLimits } from '../config/query-limits';
import { NodeStatus } from '../status/node-status';
import {
  NodeStatusAllNetworks,
  GetTransactProofsParams,
  GetBlockedShieldsParams,
  SubmitTransactProofParams,
  GetPOIsPerListParams,
  GetMerkleProofsParams,
  ValidateTxidMerklerootParams,
  GetLatestValidatedRailgunTxidParams,
  TXIDVersion,
  ValidatedRailgunTxidStatus,
  MerkleProof,
  POIsPerListMap,
  isDefined,
  TransactProofData,
} from '@railgun-community/shared-models';
import {
  GetTransactProofsParamsSchema,
  GetTransactProofsBodySchema,
  SubmitTransactProofBodySchema,
  GetPOIsPerListBodySchema,
  GetMerkleProofsBodySchema,
  ValidateTxidMerklerootBodySchema,
  GetBlockedShieldsBodySchema,
  GetBlockedShieldsParamsSchema,
  GetLatestValidatedRailgunTxidBodySchema,
  GetPOIListEventRangeBodySchema,
  SharedChainTypeIDParamsSchema,
  SubmitPOIEventBodySchema,
  SubmitValidatedTxidBodySchema,
} from './schemas';
import 'dotenv/config';
import {
  GetPOIListEventRangeParams,
  SignedBlockedShield,
  SignedPOIEvent,
  SubmitPOIEventParams,
  SubmitValidatedTxidAndMerklerootParams,
} from '../models/poi-types';
import { BlockedShieldsSyncer } from '../shields/blocked-shields-syncer';

const dbg = debug('poi:api');

// Initialize the JSON schema validator
const validator = new Validator({ allErrors: true });

export class API {
  private app: express.Express;

  private server: Optional<Server>;

  private listKeys: string[];

  static debug = false;

  constructor(listKeys: string[]) {
    this.app = express();
    this.app.use(express.json({ limit: '5mb' }));
    this.app.use(
      cors({
        methods: ['GET', 'POST'],
        origin: '*',
      }),
    );
    this.addRoutes();

    this.listKeys = listKeys;

    // Error middleware for JSON validation errors
    this.app.use(
      (
        error: Error | unknown,
        req: Request,
        res: Response,
        next: NextFunction,
      ) => {
        if (error instanceof ValidationError) {
          res
            .status(400)
            .send(
              `${
                error?.validationErrors?.body?.[0]?.message ??
                'Unknown validation error'
              }`,
            );
          return;
        }

        next(error);
      },
    );
  }

  serve(host: string, port: string) {
    if (this.server) {
      throw new Error('API already running.');
    }
    this.server = this.app.listen(Number(port), host, () => {
      dbg(`Listening at http://${host}:${port}`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    } else {
      dbg('Server was not running.');
    }
  }

  private basicAuth(req: Request, res: Response, next: NextFunction): void {
    const authorization = req.headers.authorization;

    // If no authorization header is present, return 401
    if (authorization == null || authorization == undefined) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if the authorization header is valid
    const base64Credentials = authorization.split(' ')[1] || '';
    const credentials = Buffer.from(base64Credentials, 'base64').toString(
      'utf-8',
    );
    const [username, password] = credentials.split(':');

    if (
      username === process.env.BASIC_AUTH_USERNAME &&
      password === process.env.BASIC_AUTH_PASSWORD
    ) {
      return next();
    }

    res.status(401).json({ message: 'Unauthorized' });
  }

  private safeGet = <ReturnType>(
    route: string,
    handler: (req: Request) => Promise<ReturnType>,
  ) => {
    this.app.get(
      route,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const value: ReturnType = await handler(req);
          return res.json(value).status(200).send();
        } catch (err) {
          if (API.debug) {
            // eslint-disable-next-line no-console
            console.error(err);
          }

          dbg(err);

          return res.status(500).send();

          // return next(err);
        }
      },
    );
  };

  /**
   * Safe POST handler that catches errors and returns a 500 response.
   *
   * @param route - Route to handle POST requests for
   * @param handler - Request handler function that returns a Promise
   * @param paramsSchema - JSON schema for request.params
   * @param bodySchema - JSON schema for request.body
   */
  private safePost = <ReturnType>(
    route: string,
    handler: (req: Request) => Promise<ReturnType>,
    paramsSchema: AllowedSchema,
    bodySchema: AllowedSchema,
  ) => {
    const validate = validator.validate({
      params: paramsSchema,
      body: bodySchema,
    });

    this.app.post(
      route,
      validate,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const value: ReturnType = await handler(req);
          if (isDefined(value)) {
            res.json(value);
          }
          return res.status(200).send();
        } catch (err) {
          if (API.debug) {
            // eslint-disable-next-line no-console
            console.error(err);
          }

          dbg(err);

          return res.status(500).send();

          // return next(err);
        }
      },
    );
  };

  private hasListKey(listKey: string) {
    return this.listKeys.includes(listKey);
  }

  private addRoutes() {
    this.addStatusRoutes();
    this.addAggregatorRoutes();
    this.addClientRoutes();
  }

  private addStatusRoutes() {
    this.app.get('/', (_req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    this.app.get('/perf', this.basicAuth, (_req: Request, res: Response) => {
      res.json({
        time: new Date(),
        memoryUsage: process.memoryUsage(),
        freemem: os.freemem(),
        loadavg: os.loadavg(),
      });
    });
  }

  private addAggregatorRoutes() {
    this.safeGet<NodeStatusAllNetworks>('/node-status-v2', async () => {
      return NodeStatus.getNodeStatusAllNetworks(
        this.listKeys,
        TXIDVersion.V2_PoseidonMerkle,
      );
    });

    // TODO:
    // this.safePost<NodeStatusAllNetworks>(
    //   '/node-status',
    //   async (req: Request) => {
    //     const { txidVersion } = req.body as NodeStatusParams;

    //     return NodeStatus.getNodeStatusAllNetworks(this.listKeys, txidVersion);
    //   },
    // );

    this.safePost<SignedPOIEvent[]>(
      '/poi-events/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKey, startIndex, endIndex } =
          req.body as GetPOIListEventRangeParams;
        if (!this.hasListKey(listKey)) {
          return [];
        }
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const rangeLength = endIndex - startIndex;
        if (rangeLength > QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH) {
          throw new Error(
            `Max event query range length is ${QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH}`,
          );
        }
        if (rangeLength < 0) {
          throw new Error(`Invalid query range`);
        }

        const events = await POIEventList.getPOIListEventRange(
          networkName,
          txidVersion,
          listKey,
          startIndex,
          endIndex,
        );
        return events;
      },
      SharedChainTypeIDParamsSchema,
      GetPOIListEventRangeBodySchema,
    );

    this.safePost<TransactProofData[]>(
      '/transact-proofs/:chainType/:chainID/:listKey',
      async (req: Request) => {
        const { chainType, chainID, listKey } = req.params;
        const { txidVersion, bloomFilterSerialized } =
          req.body as GetTransactProofsParams;
        if (!this.hasListKey(listKey)) {
          return [];
        }

        const networkName = networkNameForSerializedChain(chainType, chainID);

        const proofs = TransactProofMempool.getFilteredProofs(
          listKey,
          networkName,
          txidVersion,
          bloomFilterSerialized,
        );
        return proofs;
      },
      GetTransactProofsParamsSchema,
      GetTransactProofsBodySchema,
    );

    this.safePost<SignedBlockedShield[]>(
      '/blocked-shields/:chainType/:chainID/:listKey',
      async (req: Request) => {
        const { chainType, chainID, listKey } = req.params;
        const { txidVersion, bloomFilterSerialized } =
          req.body as GetBlockedShieldsParams;
        if (!this.hasListKey(listKey)) {
          return [];
        }

        const networkName = networkNameForSerializedChain(chainType, chainID);

        const proofs = BlockedShieldsSyncer.getFilteredBlockedShields(
          txidVersion,
          listKey,
          networkName,
          bloomFilterSerialized,
        );
        return proofs;
      },
      GetBlockedShieldsParamsSchema,
      GetBlockedShieldsBodySchema,
    );
  }

  private addClientRoutes() {
    this.safePost<void>(
      '/submit-transact-proof/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKey, transactProofData } =
          req.body as SubmitTransactProofParams;
        if (!this.hasListKey(listKey)) {
          return;
        }
        const networkName = networkNameForSerializedChain(chainType, chainID);

        // Submit and verify the proof
        await TransactProofMempool.submitProof(
          listKey,
          networkName,
          txidVersion,
          transactProofData,
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitTransactProofBodySchema,
    );

    this.safePost<void>(
      '/submit-poi-event/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKey, signedPOIEvent } =
          req.body as SubmitPOIEventParams;
        if (!this.hasListKey(listKey)) {
          return;
        }
        const networkName = networkNameForSerializedChain(chainType, chainID);

        // Submit and verify the proof
        await POIEventList.verifyAndAddSignedPOIEvents(
          networkName,
          txidVersion,
          listKey,
          [signedPOIEvent],
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitPOIEventBodySchema,
    );

    this.safePost<void>(
      '/submit-validated-txid/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, txidIndex, merkleroot, signature, listKey } =
          req.body as SubmitValidatedTxidAndMerklerootParams;
        if (!this.hasListKey(listKey)) {
          return;
        }
        const networkName = networkNameForSerializedChain(chainType, chainID);

        // Submit and verify the proof
        await RailgunTxidMerkletreeManager.verifySignatureAndUpdateValidatedRailgunTxidStatus(
          networkName,
          txidVersion,
          txidIndex,
          merkleroot,
          signature,
          listKey,
        );
      },
      SharedChainTypeIDParamsSchema,
      SubmitValidatedTxidBodySchema,
    );

    this.safePost<POIsPerListMap>(
      '/pois-per-list/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKeys, blindedCommitmentDatas } =
          req.body as GetPOIsPerListParams;
        listKeys.forEach(listKey => {
          if (!this.hasListKey(listKey)) {
            return;
          }
        });
        const networkName = networkNameForSerializedChain(chainType, chainID);

        if (
          blindedCommitmentDatas.length >
          QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS
        ) {
          throw new Error(
            `Too many blinded commitments: max ${QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS}`,
          );
        }
        const poiStatusMap = await POIMerkletreeManager.getPOIStatusPerList(
          networkName,
          txidVersion,
          blindedCommitmentDatas,
        );
        return poiStatusMap;
      },
      SharedChainTypeIDParamsSchema,
      GetPOIsPerListBodySchema,
    );

    this.safePost<MerkleProof[]>(
      '/merkle-proofs/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, listKey, blindedCommitments } =
          req.body as GetMerkleProofsParams;
        if (!this.hasListKey(listKey)) {
          return [];
        }
        const networkName = networkNameForSerializedChain(chainType, chainID);
        if (
          blindedCommitments.length >
          QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS
        ) {
          throw new Error(
            `Too many blinded commitments: max ${QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS}`,
          );
        }
        const merkleProofs = await POIMerkletreeManager.getMerkleProofs(
          listKey,
          networkName,
          txidVersion,
          blindedCommitments,
        );
        return merkleProofs;
      },
      SharedChainTypeIDParamsSchema,
      GetMerkleProofsBodySchema,
    );

    this.safePost<ValidatedRailgunTxidStatus>(
      '/validated-txid/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion } = req.body as GetLatestValidatedRailgunTxidParams;
        const networkName = networkNameForSerializedChain(chainType, chainID);

        const validatedRailgunTxidStatus =
          await RailgunTxidMerkletreeManager.getValidatedRailgunTxidStatus(
            networkName,
            txidVersion,
          );
        return validatedRailgunTxidStatus;
      },
      SharedChainTypeIDParamsSchema,
      GetLatestValidatedRailgunTxidBodySchema,
    );

    this.safePost<boolean>(
      '/validate-txid-merkleroot/:chainType/:chainID',
      async (req: Request) => {
        const { chainType, chainID } = req.params;
        const { txidVersion, tree, index, merkleroot } =
          req.body as ValidateTxidMerklerootParams;
        const networkName = networkNameForSerializedChain(chainType, chainID);
        const isValid =
          await RailgunTxidMerkletreeManager.checkIfMerklerootExists(
            networkName,
            txidVersion,
            tree,
            index,
            merkleroot,
          );
        return isValid;
      },
      SharedChainTypeIDParamsSchema,
      ValidateTxidMerklerootBodySchema,
    );
  }
}
