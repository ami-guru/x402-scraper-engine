import { Env, VerificationResult } from './types';

// Standard ERC-20 Transfer event signature: Transfer(address,address,uint256)
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DEFAULT_USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const DEFAULT_PRICE_UNITS = 2000n; // 0.002 USDC (6 decimals)
const DEFAULT_WINDOW_SECONDS = 900; // 15 minutes

/**
 * Validates a transaction hash format
 */
export function isValidTxHash(hash: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(hash);
}

/**
 * Formats an Ethereum address into a 32-byte log topic
 */
function addressToTopic(address: string): string {
  const clean = address.toLowerCase().replace(/^0x/, '');
  return '0x' + clean.padStart(64, '0');
}

/**
 * Extracts an Ethereum address from a 32-byte log topic
 */
function topicToAddress(topic: string): string {
  const clean = topic.toLowerCase().replace(/^0x/, '');
  return '0x' + clean.slice(24);
}

export interface PaymentChallengeConfig {
  amountUsdc: string;
  amountUnits?: string;
  recipient: string;
  resourceUrl?: string;
  resourceDescription?: string;
  serviceName?: string;
  tags?: string[];
  inputBody?: Record<string, any>;
  inputProperties?: Record<string, any>;
  inputRequired?: string[];
  outputExample?: Record<string, any>;
  network?: string;
  chainId?: number | string;
  contractAddress?: string;
  windowSeconds?: number | string;
}

export interface StandardPaymentChallengeResult {
  headers: Record<string, string>;
  responseBody: Record<string, any>;
  standardPayload: Record<string, any>;
}

/**
 * Creates standard x402 V2 challenge with official CDP/PayAI Bazaar extensions and legacy backward compatibility
 */
export function createStandardPaymentChallenge(config: PaymentChallengeConfig): StandardPaymentChallengeResult {
  const units = config.amountUnits || Math.round(parseFloat(config.amountUsdc) * 1_000_000).toString();
  const usdcContract = config.contractAddress || DEFAULT_USDC_BASE;
  const chainId = Number(config.chainId || 8453);
  const networkCaip2 = `eip155:${chainId}`;

  const inputProps = config.inputProperties || { url: { type: 'string', format: 'uri' } };
  const inputReq = config.inputRequired || ['url'];
  const inputBodyVal = config.inputBody || { url: 'https://example.com' };

  const v2StandardPayload: Record<string, any> = {
    x402Version: 2,
    error: 'PAYMENT-SIGNATURE header is required',
    resource: {
      url: config.resourceUrl || 'https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape',
      description: config.resourceDescription || 'Autonomous HTTP 402 Web Scraper & Intelligence for AI Agents on Base L2',
      mimeType: 'application/json',
      serviceName: config.serviceName || 'x402 Scraper Engine',
      tags: config.tags || ['scraper', 'markdown', 'llama3', 'web3', 'base', 'usdc'],
      iconUrl: 'https://getguruautomations.com/favicon.ico'
    },
    accepts: [
      {
        scheme: 'exact',
        network: networkCaip2,
        asset: usdcContract,
        currency: usdcContract,
        amount: units,
        maxAmountRequired: units,
        payTo: config.recipient,
        recipient: config.recipient,
        maxTimeoutSeconds: Number(config.windowSeconds || 3600),
        extra: {
          credentialTypes: ['authorization'],
          name: 'USD Coin',
          version: '2'
        }
      }
    ],
    extensions: {
      bazaar: {
        info: {
          input: {
            type: 'http',
            method: 'POST',
            bodyType: 'json',
            body: inputBodyVal
          },
          output: {
            type: 'json',
            example: config.outputExample || {
              success: true,
              data: {}
            }
          }
        },
        schema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          properties: {
            input: {
              type: 'object',
              required: ['type', 'method', 'bodyType', 'body'],
              properties: {
                type: { const: 'http', type: 'string' },
                method: { enum: ['POST'], type: 'string' },
                bodyType: { enum: ['json'], type: 'string' },
                body: {
                  type: 'object',
                  required: inputReq,
                  properties: inputProps
                }
              }
            },
            output: {
              type: 'object',
              required: ['type'],
              properties: {
                type: { type: 'string' }
              }
            }
          },
          required: ['input']
        }
      }
    },
    // Backward compatibility fields for legacy clients
    x402_version: '2.0',
    network: config.network || 'base',
    chain_id: chainId,
    asset: 'USDC',
    contract_address: usdcContract,
    amount_usdc: config.amountUsdc,
    recipient: config.recipient,
    max_receipt_age_seconds: Number(config.windowSeconds || 900)
  };

  const jsonStr = JSON.stringify(v2StandardPayload);
  const base64V2 = typeof btoa === 'function' ? btoa(jsonStr) : Buffer.from(jsonStr).toString('base64');

  const headers: Record<string, string> = {
    'PAYMENT-REQUIRED': base64V2,
    'X-Payment-Version': '2',
    'X-Payment-Network': config.network || 'base',
    'X-Payment-Chain-Id': String(chainId),
    'X-Payment-Asset': 'USDC',
    'X-Payment-Asset-Address': usdcContract,
    'X-Payment-Amount': config.amountUsdc,
    'X-Payment-To': config.recipient,
    'X-Payment-Window': String(config.windowSeconds || 900)
  };

  const responseBody = {
    ...v2StandardPayload,
    error: 'Payment Required',
    protocol: 'x402',
    spec_version: '2.0',
    message: `This endpoint requires an on-chain microtransaction of ${config.amountUsdc} USDC on Base. Free grace calls exhausted.`,
    payment: {
      version: 2,
      network: config.network || 'base',
      chain_id: chainId,
      asset: 'USDC',
      contractAddress: usdcContract,
      amount: config.amountUsdc,
      amount_usdc: config.amountUsdc,
      amount_units: units,
      recipient: config.recipient,
      windowSeconds: Number(config.windowSeconds || 900),
      instruction: `Transfer ${config.amountUsdc} USDC to ${config.recipient} on Base (Chain ID 8453), then resubmit with header 'X-Payment-Receipt: <tx_hash>' or 'PAYMENT-SIGNATURE: <base64>'`
    }
  };

  return { headers, responseBody, standardPayload: v2StandardPayload };
}

/**
 * Formats standard x402 V2 and backward-compatible payment headers
 */
export function createPaymentChallengeHeaders(config: PaymentChallengeConfig): Record<string, string> {
  return createStandardPaymentChallenge(config).headers;
}

/**
 * Perform on-chain verification of a transaction receipt on Base
 */
export async function verifyBasePayment(
  txHash: string,
  env: Env,
  requiredAmountOverrideUnits?: bigint,
  rpcOverride?: string
): Promise<VerificationResult> {
  const cleanTxHash = txHash.trim().toLowerCase();

  if (!isValidTxHash(cleanTxHash)) {
    return { valid: false, error: 'Malformed transaction hash format. Expected 0x followed by 64 hex characters.' };
  }

  const expectedUsdc = (env.USDC_CONTRACT_ADDRESS || DEFAULT_USDC_BASE).toLowerCase();
  const expectedTreasury = env.TREASURY_WALLET_ADDRESS.toLowerCase();
  const requiredAmountUnits = requiredAmountOverrideUnits || (env.PRICE_USDC_UNITS ? BigInt(env.PRICE_USDC_UNITS) : 20000n);
  const maxAgeSeconds = env.PAYMENT_WINDOW_SECONDS ? Number(env.PAYMENT_WINDOW_SECONDS) : DEFAULT_WINDOW_SECONDS;
  const rpcUrl = rpcOverride || env.BASE_RPC_URL || 'https://mainnet.base.org';

  // 1. JSON-RPC Call: eth_getTransactionReceipt
  let receipt: any = null;
  try {
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [cleanTxHash]
      })
    });

    if (!rpcResponse.ok) {
      return { valid: false, error: `Base RPC request failed with HTTP status ${rpcResponse.status}` };
    }

    const rpcJson: any = await rpcResponse.json();
    if (rpcJson.error) {
      return { valid: false, error: `Base RPC error: ${rpcJson.error.message || JSON.stringify(rpcJson.error)}` };
    }

    receipt = rpcJson.result;
    if (!receipt) {
      return { valid: false, error: 'Transaction receipt not found. Transaction may still be unconfirmed or dropped.' };
    }
  } catch (err: any) {
    return { valid: false, error: `Failed to connect to Base RPC: ${err.message}` };
  }

  // 2. Check Execution Status
  if (receipt.status !== '0x1') {
    return { valid: false, error: 'Transaction execution failed or reverted on-chain (status != 0x1).' };
  }

  // 3. Query Block for Timestamp Verification
  let blockTimestamp = 0;
  const blockNumber = parseInt(receipt.blockNumber, 16);

  try {
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getBlockByHash',
        params: [receipt.blockHash, false]
      })
    });

    const blockJson: any = await blockResponse.json();
    if (blockJson.result && blockJson.result.timestamp) {
      blockTimestamp = parseInt(blockJson.result.timestamp, 16);
    }
  } catch (e) {
    // If block hash fails, fallback to block number
    try {
      const blockResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'eth_getBlockByNumber',
          params: [receipt.blockNumber, false]
        })
      });
      const blockJson: any = await blockResponse.json();
      if (blockJson.result && blockJson.result.timestamp) {
        blockTimestamp = parseInt(blockJson.result.timestamp, 16);
      }
    } catch (_) {
      // Ignored, handled below
    }
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (blockTimestamp > 0) {
    const ageSeconds = nowSeconds - blockTimestamp;
    if (ageSeconds > maxAgeSeconds) {
      return {
        valid: false,
        error: `Transaction expired: finalized ${ageSeconds}s ago (maximum allowed window is ${maxAgeSeconds}s).`
      };
    }
  }

  // 4. Inspect Event Logs for USDC Transfer to Treasury
  const expectedTreasuryTopic = addressToTopic(expectedTreasury);
  let matchedTransfer: { from: string; value: bigint } | null = null;

  for (const log of receipt.logs || []) {
    const logContract = log.address.toLowerCase();
    if (logContract !== expectedUsdc) {
      continue;
    }

    if (!log.topics || log.topics.length < 3) {
      continue;
    }

    const eventTopic = log.topics[0].toLowerCase();
    const recipientTopic = log.topics[2].toLowerCase();

    if (eventTopic === ERC20_TRANSFER_TOPIC && recipientTopic === expectedTreasuryTopic) {
      const fromAddress = topicToAddress(log.topics[1]);
      const value = BigInt(log.data || '0x0');

      if (value >= requiredAmountUnits) {
        matchedTransfer = { from: fromAddress, value };
        break;
      }
    }
  }

  if (!matchedTransfer) {
    return {
      valid: false,
      error: `No valid transfer found in transaction. Must transfer at least ${Number(requiredAmountUnits) / 1e6} USDC to treasury (${expectedTreasury}) via contract ${expectedUsdc}.`
    };
  }

  return {
    valid: true,
    sender: matchedTransfer.from,
    amountUnits: matchedTransfer.value,
    timestamp: blockTimestamp || nowSeconds,
    blockNumber
  };
}

/**
 * Checks and marks a transaction hash in Cloudflare KV to prevent replay attacks
 */
export async function checkAndRecordReplay(
  txHash: string,
  env: Env,
  metadata: Record<string, any>
): Promise<{ replayed: boolean; error?: string }> {
  const cleanTxHash = txHash.trim().toLowerCase();
  const kvKey = `tx:${cleanTxHash}`;

  try {
    if (!env.PROCESSED_TXS) {
      // If KV is not bound (e.g. mock test environment), skip KV check
      return { replayed: false };
    }

    const existing = await env.PROCESSED_TXS.get(kvKey);
    if (existing !== null) {
      return { replayed: true, error: 'Transaction already redeemed. Replay attacks are prohibited.' };
    }

    const ttl = env.REPLAY_EXPIRATION_SECONDS ? Number(env.REPLAY_EXPIRATION_SECONDS) : 86400;

    await env.PROCESSED_TXS.put(
      kvKey,
      JSON.stringify({
        ...metadata,
        redeemedAt: new Date().toISOString()
      }),
      { expirationTtl: ttl }
    );

    return { replayed: false };
  } catch (err: any) {
    return { replayed: false, error: `KV error: ${err.message}` };
  }
}
