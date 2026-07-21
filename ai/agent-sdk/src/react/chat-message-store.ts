import type { Agent } from '../agent';
import type { DisplayMessage } from './types';

type MessageListener = (messages: DisplayMessage[]) => void;

interface MessageStore {
  messages: DisplayMessage[];
  listeners: Set<MessageListener>;
}

const stores = new WeakMap<Agent, MessageStore>();

function getStore(agent: Agent): MessageStore {
  let store = stores.get(agent);
  if (!store) {
    store = { messages: [], listeners: new Set() };
    stores.set(agent, store);
  }
  return store;
}

export function getSharedChatMessages(agent: Agent): DisplayMessage[] {
  return getStore(agent).messages;
}

export function setSharedChatMessages(agent: Agent, messages: DisplayMessage[]): void {
  const store = getStore(agent);
  store.messages = messages;
  for (const listener of store.listeners) {
    listener(messages);
  }
}

export function subscribeSharedChatMessages(agent: Agent, listener: MessageListener): () => void {
  const store = getStore(agent);
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}
