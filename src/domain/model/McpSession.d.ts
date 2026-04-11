export type McpSession = {
    public server: McpServer;
    public transport: WebStandardStreamableHTTPServerTransport;
    public sessionId: string;
}
