export interface PublicWebSearchResult {
    readonly rank: number;
    readonly title: string;
    readonly url: string;
    readonly snippet: string;
    readonly sourceHost: string;
}
export interface PublicWebSearchResponse {
    readonly query: string;
    readonly searchedAt: string;
    readonly provider: 'duckduckgo-html';
    readonly results: readonly PublicWebSearchResult[];
}
export interface PublicWebSearchOptions {
    readonly timeoutMs?: number;
    readonly maxResults?: number;
    readonly fetchImpl?: typeof fetch;
    readonly now?: () => Date;
}
/**
 * Credential-free native discovery provider for public-web research.
 * The provider endpoint is fixed; user input is encoded only as a search query.
 */
export declare class PublicWebSearchClient {
    private readonly options;
    constructor(options?: PublicWebSearchOptions);
    search(query: string, requestedLimit?: number): Promise<PublicWebSearchResponse>;
}
export declare function parseDuckDuckGoHtml(html: string, limit?: number): readonly PublicWebSearchResult[];
//# sourceMappingURL=public-web-search.d.ts.map