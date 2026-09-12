import { z } from "zod";
/**
 * Input schema for clean webpage scraping.
 */
export const ScrapeWebpageSchema = z.object({
    url: z.string().url().describe("The public web URL to scrape into clean, token-efficient Markdown.")
});
/**
 * Input schema for Edge Llama-3 webpage context synthesis.
 */
export const DigestWebpageSchema = z.object({
    url: z.string().url().describe("The public web URL to summarize and extract entities from."),
    prompt: z.string().optional().describe("Optional focus area or custom prompt for summary extraction."),
    focus: z.string().optional().describe("Alias for prompt focus area.")
});
/**
 * Input schema for website security and credibility auditing.
 */
export const AuditWebpageSchema = z.object({
    url: z.string().url().describe("The target web domain or URL to audit for phishing, risk, and credibility.")
});
/**
 * Input schema for multi-source live web research.
 */
export const SearchWebSchema = z.object({
    query: z.string().min(1).describe("Search query to research across the web."),
    limit: z.number().int().min(1).max(20).optional().default(5).describe("Maximum number of search results to return (default: 5).")
});
/**
 * Input schema for Twitter/X keyword and cashtag search.
 */
export const SearchTwitterSchema = z.object({
    query: z.string().min(1).describe("Keyword, hashtag, or cashtag (e.g. $BASE, #crypto) to search on Twitter/X."),
    maxResults: z.number().int().min(1).max(50).optional().default(10).describe("Maximum number of tweets to return (default: 10).")
});
/**
 * Input schema for Twitter/X user profile and timeline extraction.
 */
export const GetTwitterProfileSchema = z.object({
    username: z.string().min(1).describe("Twitter/X handle or username without the leading @ symbol.")
});
