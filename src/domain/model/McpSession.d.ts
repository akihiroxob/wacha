export type McpSession = {
    public server: McpServer;
    public transport: WebStandardStreamableHTTPServerTransport;
    public workerId: string;
    public sessionId: string;
}
