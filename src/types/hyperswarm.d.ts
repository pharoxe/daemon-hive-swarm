declare module "hyperswarm";

declare module "b4a" {
  const b4a: {
    from(value: string | ArrayBuffer | Uint8Array | number[], encoding?: string): Uint8Array;
    toString(value: Uint8Array, encoding?: string): string;
  };
  export default b4a;
}

declare module "bare-rpc" {
  export default class RPC {
    constructor(stream: unknown, onrequest?: (request: unknown) => unknown);
    event(command: number): { send(data?: unknown, encoding?: unknown): void };
    request(command: number): {
      send(data?: unknown, encoding?: unknown): void;
      reply<T = unknown>(encoding?: unknown): Promise<T>;
    };
  }
}

declare module "react-native-bare-kit" {
  export class Worklet {
    IPC: unknown;
    start(filename: string, source: string): void;
  }
}

declare module "*.bundle.mjs" {
  const source: string;
  export default source;
}

declare module "../hive/rpcCommands.mjs" {
  export const JOIN_HIVE: number;
  export const LEAVE_HIVE: number;
  export const HIVE_STATUS: number;
  export const PEER_JOINED: number;
  export const PEER_LEFT: number;
  export const PEER_MESSAGE: number;
  export const BROADCAST_CAPABILITIES: number;
  export const DELEGATE_PROVIDER_SELECTED: number;
  export const HIVE_PROTOCOL_VERSION: number;
  export const HIVE_TOPIC_LABEL: string;
  export const HIVE_TOPIC_SEED: string;
  export const HIVE_MESSAGE_TYPES: Record<string, string>;
}
