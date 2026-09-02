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

/**
 * Perform on-chain verification of a transaction receipt on Base
 */
export async function verifyBasePayment(
  txHash: string,
  env: Env,
  rpcOverride?: string
): Promise<VerificationResult> {
  const cleanTxHash = txHash.trim().toLowerCase();

  if (!isValidTxHash(cleanTxHash)) {
    return { valid: false, error: 'Malformed transaction hash format. Expected 0x followed by 64 hex characters.' };
  }

  const expectedUsdc = (env.USDC_CONTRACT_ADDRESS || DEFAULT_USDC_BASE).toLowerCase();
  const expectedTreasury = env.TREASURY_WALLET_ADDRESS.toLowerCase();
  const requiredAmountUnits = env.PRICE_USDC_UNITS ? BigInt(env.PRICE_USDC_UNITS) : DEFAULT_PRICE_UNITS;
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
