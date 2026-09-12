import { z } from "zod";
/**
 * Input schema for clean webpage scraping.
 */
export declare const ScrapeWebpageSchema: z.ZodObject<{
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url?: string;
}, {
    url?: string;
}>;
/**
 * Input schema for Edge Llama-3 webpage context synthesis.
 */
export declare const DigestWebpageSchema: z.ZodObject<{
    url: z.ZodString;
    prompt: z.ZodOptional<z.ZodString>;
    focus: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url?: string;
    prompt?: string;
    focus?: string;
}, {
    url?: string;
    prompt?: string;
    focus?: string;
}>;
/**
 * Input schema for website security and credibility auditing.
 */
export declare const AuditWebpageSchema: z.ZodObject<{
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url?: string;
}, {
    url?: string;
}>;
/**
 * Input schema for multi-source live web research.
 */
export declare const SearchWebSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    query?: string;
    limit?: number;
}, {
    query?: string;
    limit?: number;
}>;
/**
 * Input schema for Twitter/X keyword and cashtag search.
 */
export declare const SearchTwitterSchema: z.ZodObject<{
    query: z.ZodString;
    maxResults: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    query?: string;
    maxResults?: number;
}, {
    query?: string;
    maxResults?: number;
}>;
/**
 * Input schema for Twitter/X user profile and timeline extraction.
 */
export declare const GetTwitterProfileSchema: z.ZodObject<{
    username: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username?: string;
}, {
    username?: string;
}>;
