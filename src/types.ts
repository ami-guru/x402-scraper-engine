export interface Env {
  PROCESSED_TXS: KVNamespace;
  AI?: any;
  NETWORK?: string;
  CHAIN_ID?: string | number;
  USDC_CONTRACT_ADDRESS?: string;
  PRICE_USDC?: string;
  PRICE_USDC_UNITS?: string;
  SCRAPE_PRICE_USDC?: string;
  SCRAPE_PRICE_UNITS?: string;
  DIGEST_PRICE_USDC?: string;
  DIGEST_PRICE_UNITS?: string;
  AUDIT_PRICE_USDC?: string;
  AUDIT_PRICE_UNITS?: string;
  SEARCH_PRICE_USDC?: string;
  SEARCH_PRICE_UNITS?: string;
  TWITTER_SEARCH_PRICE_USDC?: string;
  TWITTER_SEARCH_PRICE_UNITS?: string;
  TWITTER_PROFILE_PRICE_USDC?: string;
  TWITTER_PROFILE_PRICE_UNITS?: string;
  PAYMENT_WINDOW_SECONDS?: string | number;
  REPLAY_EXPIRATION_SECONDS?: string | number;
  BASE_RPC_URL?: string;
  TREASURY_WALLET_ADDRESS: string;
}

export interface ScrapeRequest {
  url: string;
  format?: 'markdown' | 'text';
}

export interface DigestRequest {
  url: string;
  focus?: string;
}

export interface AuditRequest {
  url: string;
  contract_address?: string;
}

export interface SearchRequest {
  query: string;
  limit?: number;
}

export interface TwitterSearchRequest {
  query: string;
  limit?: number;
}

export interface TwitterProfileRequest {
  username: string;
}

export interface TweetItem {
  id?: string;
  author: string;
  text: string;
  url?: string;
  timestamp?: string;
}

export interface TwitterSearchResponse {
  success: boolean;
  query: string;
  tweets: TweetItem[];
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

export interface TwitterProfileResponse {
  success: boolean;
  username: string;
  bio?: string;
  tweets: TweetItem[];
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

export interface DigestResponse {
  success: boolean;
  url: string;
  title: string;
  executive_summary: string;
  key_takeaways: string[];
  structured_entities?: Record<string, any>;
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

export interface AuditResponse {
  success: boolean;
  url: string;
  credibility_score: number; // 0 - 100
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  security_flags: string[];
  credibility_analysis: string;
  technical_signals: {
    has_ssl: boolean;
    has_external_scripts: boolean;
    suspicious_redirects: boolean;
    domain_reputation: string;
  };
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
