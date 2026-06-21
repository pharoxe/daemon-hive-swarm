export const JOIN_HIVE = 1;
export const LEAVE_HIVE = 2;
export const HIVE_STATUS = 3;
export const PEER_JOINED = 4;
export const PEER_LEFT = 5;
export const PEER_MESSAGE = 6;
export const BROADCAST_CAPABILITIES = 7;
export const DELEGATE_PROVIDER_SELECTED = 8;
export const INIT_HIVE_STORAGE = 9;
export const APPEND_DATASET_SHARE = 10;
export const GET_DATASET_STATS = 11;
export const DELETE_MEDICAL_DATASET_SHARES = 12;

export const HIVE_PROTOCOL_VERSION = 1;
export const HIVE_TOPIC_LABEL = "hivemind";
export const HIVE_TOPIC_SEED = "daemon:hive:v1:hivemind";
export const HIVE_CORESTORE_TOPIC_LABEL = "hive-corestore";
export const HIVE_CORESTORE_TOPIC_SEED = "daemon:hive:v1:corestore";

export const HIVE_MESSAGE_TYPES = {
  hello: "daemon:hive:hello",
  capabilities: "daemon:hive:capabilities",
  memorySummary: "daemon:hive:memory:summary",
  delegateProvider: "daemon:hive:delegate:provider",
};
