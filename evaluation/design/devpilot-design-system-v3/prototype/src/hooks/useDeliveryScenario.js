import { useState } from 'react';
import { initialDelivery, scenarios, transitionDelivery } from '../components/deliveryScenarioModel.js';

export function useDeliveryScenario(releaseId) {
  const key = `devpilot-delivery-scenario-v1:${releaseId}`;
  const read = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key));
      return saved && scenarios[saved.scenario] && Array.isArray(saved.events) ? saved : initialDelivery();
    } catch { return initialDelivery(); }
  };
  const [state, setState] = useState(read);
  const [storageError, setStorageError] = useState(false);
  const save = (next) => {
    try { sessionStorage.setItem(key, JSON.stringify(next)); }
    catch { setStorageError(true); }
    return next;
  };
  return {
    state, storageError,
    select: (scenario) => setState(save(initialDelivery(scenario))),
    dispatch: (event) => setState((current) => save(transitionDelivery(current, event))),
    reload: () => setState(read()),
  };
}
