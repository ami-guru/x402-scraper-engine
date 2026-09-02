export interface Env {
  PROCESSED_TXS: KVNamespace;
  NETWORK?: string;
  CHAIN_ID?: string | number;
  USDC_CONTRACT_ADDRESS?: string;
  PRICE_USDC?: string;
  PRICE_USDC_UNITS?: string;
  PAYMENT_WINDOW_SECONDS?: string | number;
  REPLAY_EXPIRATION_SECONDS?: string | number;
  BASE_RPC_URL?: string;
  TREASURY_WALLET_ADDRESS: string;
}

export interface ScrapeRequest {
  url: string;
  format?: 'markdown' | 'text';
}

export interface ScrapeResponse {
  success: boolean;
  url: string;
  title?: string;
  markdown: string;
  tokens_estimated: number;
  payment?: {
    tx_hash: string;
    network: string;
    amount: string;
    asset: string;
    settled_at: string;
  };
}

export interface PaymentRequirement {
  version: number;
  network: string;
  chainId: number;
  asset: string;
  contractAddress: string;
  amount: string;
  amountUnits: string;
  recipient: string;
  windowSeconds: number;
  description: string;
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
  sender?: string;
  amountUnits?: bigint;
  timestamp?: number;
  blockNumber?: number;
}
