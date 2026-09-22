import { useEffect, useRef, useState } from "react";
import { assetKey, type AssetCollection, type PanelAsset } from "../map/cd2Assets";
import type { NeighborhoodIntent } from "./contracts";
import { interpretQuestion } from "./client";
import { resolveResources } from "./resourceEngine";

export type Origin = { longitude: number; latitude: number };
export type ResourceResult = ReturnType<typeof resolveResources>;
export type ThreadMessage = { role: "user" | "assistant"; text: string };

/** This demo owns no persistent session; only validated intents cross the API boundary. */
export function useNeighborhoodChat(assets: AssetCollection | null) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [intent, setIntent] = useState<NeighborhoodIntent | null>(null);
  const [result, setResult] = useState<ResourceResult | null>(null);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const [neighborhood, setNeighborhood] = useState<string | null>(null);
  const [pending, setPending] = useState<ResourceResult | null>(null);
  const request = useRef<AbortController | null>(null);

  function cancelRequest() {
    request.current?.abort();
    request.current = null;
    setIsSending(false);
  }
  useEffect(() => () => request.current?.abort(), []);

  function apply(next: NeighborhoodIntent, point = origin, key = selectedKey) {
    if (!assets) return;
    const resolved = resolveResources(assets, next, point, key);
    setMessages((previous) => [...previous, { role: "assistant", text: resolved.answer }]);
    setPending(resolved.needs ? resolved : null);
    if (["find", "nearest", "details"].includes(next.action)) {
      setIntent(next);
      setNeighborhood(next.neighborhood);
      if (!resolved.needs) {
        setResult(resolved);
        setSelectedKey(resolved.items.length === 1 ? resolved.items[0].key : null);
      }
    }
  }

  async function send(question: string, retry = false) {
    const text = question.trim();
    if (!assets || !text || isSending) return;
    cancelRequest();
    const controller = new AbortController();
    request.current = controller;
    setIsSending(true);
    setError(null);
    setLastQuestion(text);
    if (!retry) setMessages((previous) => [...previous, { role: "user", text }]);
    try {
      const selected = selectedKey ? assets.features.find((feature) =>
        assetKey(feature.properties) === selectedKey,
      ) : null;
      const context = { ...intent, neighborhood, ...(selected ? { resource_name: selected.properties.label } : {}) };
      const next = await interpretQuestion(text, context, controller.signal);
      if (request.current !== controller || controller.signal.aborted) return;
      apply(next);
    } catch {
      if (request.current !== controller || controller.signal.aborted) return;
      setError("Neighborhood chat is unavailable right now; check the local backend and try again.");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setIsSending(false);
      }
    }
  }

  function chooseNeighborhood(name: string) {
    cancelRequest();
    setNeighborhood(name);
    setMessages((previous) => [...previous, { role: "user", text: name }]);
    if (intent) apply({ ...intent, neighborhood: name });
  }

  function choosePoint(point: Origin) {
    cancelRequest();
    setOrigin(point);
    setMessages((previous) => [...previous, { role: "user", text: "Use the point I selected on the map." }]);
    if (intent) apply(intent, point);
  }

  function chooseResource(item: PanelAsset) {
    cancelRequest();
    setSelectedKey(item.key);
    if (pending?.needs === "resource" && intent) {
      setMessages((previous) => [...previous, { role: "user", text: `${item.properties.label} — ${item.properties.neighborhood}` }]);
      // The key resolves duplicate labels without trusting a model-created identifier.
      apply({ ...intent, action: "details", resource_name: null }, origin, item.key);
    }
  }

  function clearResults() {
    cancelRequest();
    setResult(null);
    setPending(null);
    setSelectedKey(null);
  }

  function reset() {
    clearResults();
    setMessages([]);
    setIntent(null);
    setOrigin(null);
    setNeighborhood(null);
    setError(null);
    setLastQuestion("");
  }

  return { messages, result, pending, origin, neighborhood, intent, isSending, error, lastQuestion,
    send, chooseNeighborhood, choosePoint, chooseResource, setNeighborhood, clearResults, reset, cancelRequest };
}
