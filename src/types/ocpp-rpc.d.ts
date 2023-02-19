declare module 'ocpp-rpc' {
  export interface HandlerProperties {
    method: string;
    params: Record<string, unknown>;
    signal: AbortSignal;
    messageId: string;
    reply: () => void;
  }

  export type Handler = (props: HandlerProperties) => void;

  export interface RPCClient {
    endpoint: string;
    identity: string;
    handle: (method: string | Handler, handler?: Handler) => void;
  }

  export const RPCServer: any;
  export const createRPCError: any;
}
