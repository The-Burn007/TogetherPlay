/**
 * Robust Multiplayer Recovery Architecture
 * 
 * ARCHITECTURAL PRINCIPLES:
 * 1. THE SERVER/FIREBASE AUTHORITATIVE STATE IS THE ONLY SOURCE OF TRUTH.
 * 2. React component state is UNTRUSTED and transient.
 * 3. Recovery must seamlessly handle:
 *    - Browser refresh
 *    - Tab restoration / wake from sleep
 *    - Network loss & reconnect (Wi-Fi / mobile switch)
 *    - WebRTC failure
 *    - Firebase listener interruption
 *    - Actions submitted before disconnect but committed during disconnect
 *    - Stale browser tabs (multi-tab sync)
 *    - Games ending while client is offline
 *    - Partner disconnect/reconnect
 *    - Prevention of duplicate sessions and duplicate actions
 */

import type {
  GameSession,
  GameState,
  GameAction,
  GameActionResult,
  GameStatus,
  GameType,
} from "@/types/domain";
import { authoritativeGameClient } from "@/lib/firebase/services/authoritativeGameClient";

export type GamePhase =
  | "lobby"
  | "waiting"
  | "ready"
  | "countdown"
  | "playing"
  | "round_end"
  | "game_end";

export type RecoveryConnectionStatus =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected";

export type PartnerStatus = "connected" | "reconnecting" | "offline";

export interface InFlightActionRecord {
  clientActionId: string;
  gameId: string;
  type: string;
  payload: unknown;
  playerId: string;
  submittedAt: number;
  targetStateVersion?: number;
  status:
    | "pending"
    | "committed"
    | "committed_during_disconnect"
    | "rejected"
    | "obsolete";
  error?: string;
}

export interface MultiplayerRecoveryCallbacks {
  onStateReconciled?: (
    state: GameState,
    session: GameSession,
    phase: GamePhase,
    actionReconciled?: InFlightActionRecord
  ) => void;
  onActionCommittedDuringDisconnect?: (action: InFlightActionRecord) => void;
  onGameEndedWhileOffline?: (state: GameState) => void;
  onPartnerConnectionChange?: (status: PartnerStatus) => void;
  onPhaseChange?: (phase: GamePhase) => void;
  onConnectionStatusChange?: (status: RecoveryConnectionStatus) => void;
}

export interface MultiplayerRecoveryConfig extends MultiplayerRecoveryCallbacks {
  gameId: string;
  playerId: string;
  enableTabSync?: boolean;
  tabId?: string;
  fetchAggregateFn?: (
    gameId: string
  ) => Promise<{ session: GameSession; state: GameState } | null>;
  submitActionFn?: (
    action: GameAction,
    actingUid?: string
  ) => Promise<GameActionResult>;
  subscribeEphemeralFn?: (
    gameId: string,
    callback: (state: GameState | null) => void
  ) => () => void;
  subscribeDurableFn?: (
    gameId: string,
    callback: (session: GameSession | null) => void
  ) => () => void;
}

/**
 * Computes authoritative game phase strictly from server state.
 * Prevents stale local countdowns or local optimistic flags from overriding server reality.
 */
export function computeAuthoritativePhase(
  state: GameState | null,
  session: GameSession | null
): GamePhase {
  if (!state && !session) return "waiting";

  // Highest priority: Game has concluded
  if (
    state?.isFinished ||
    state?.status === "game_end" ||
    session?.status === "game_end" ||
    session?.status === "results"
  ) {
    return "game_end";
  }

  // Round ended / intermission
  if (state?.status === "round_end" || session?.status === "round_end") {
    return "round_end";
  }

  // Active playing stage
  if (state?.status === "playing" || session?.status === "playing") {
    return "playing";
  }

  // Countdown stage
  if (state?.status === "countdown" || session?.status === "countdown") {
    return "countdown";
  }

  // Ready in lobby
  if (state?.status === "ready" || session?.status === "ready") {
    return "ready";
  }

  // Waiting in lobby
  if (state?.status === "waiting" || session?.status === "waiting") {
    return "waiting";
  }

  return "waiting";
}

/**
 * In-Flight Action Storage:
 * Mirrors pending actions in sessionStorage when in a browser environment,
 * surviving browser refresh and tab restoration.
 */
class InFlightActionStorage {
  private memoryStore = new Map<string, InFlightActionRecord>();

  private getStorageKey(gameId: string): string {
    return `tp_inflight_${gameId}`;
  }

  getAll(gameId: string): InFlightActionRecord[] {
    const list: InFlightActionRecord[] = [];
    // 1. In-memory
    for (const record of this.memoryStore.values()) {
      if (record.gameId === gameId && record.status === "pending") {
        list.push(record);
      }
    }

    // 2. SessionStorage fallback if available
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const raw = window.sessionStorage.getItem(this.getStorageKey(gameId));
        if (raw) {
          const parsed = JSON.parse(raw) as InFlightActionRecord[];
          for (const item of parsed) {
            if (!this.memoryStore.has(item.clientActionId)) {
              this.memoryStore.set(item.clientActionId, item);
              list.push(item);
            }
          }
        }
      } catch {
        // Storage restricted or unavailable
      }
    }

    return list;
  }

  set(record: InFlightActionRecord): void {
    this.memoryStore.set(record.clientActionId, record);
    this.persist(record.gameId);
  }

  remove(gameId: string, clientActionId: string): void {
    this.memoryStore.delete(clientActionId);
    this.persist(gameId);
  }

  clear(gameId: string): void {
    for (const [id, record] of this.memoryStore.entries()) {
      if (record.gameId === gameId) {
        this.memoryStore.delete(id);
      }
    }
    this.persist(gameId);
  }

  private persist(gameId: string): void {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const active = Array.from(this.memoryStore.values()).filter(
          (r) => r.gameId === gameId && r.status === "pending"
        );
        if (active.length > 0) {
          window.sessionStorage.setItem(this.getStorageKey(gameId), JSON.stringify(active));
        } else {
          window.sessionStorage.removeItem(this.getStorageKey(gameId));
        }
      } catch {
        // Fallback
      }
    }
  }
}

export const inFlightActionStorage = new InFlightActionStorage();

/**
 * MultiplayerRecoveryCoordinator:
 * Manages full lifecycle, rehydration, in-flight action reconciliation,
 * and listener management.
 */
export class MultiplayerRecoveryCoordinator {
  readonly config: MultiplayerRecoveryConfig;
  readonly tabId: string;

  private _session: GameSession | null = null;
  private _state: GameState | null = null;
  private _phase: GamePhase = "waiting";
  private _connectionStatus: RecoveryConnectionStatus = "connecting";
  private _partnerStatus: PartnerStatus = "connected";
  private _isRehydrating = false;
  private _isSubmittingAction = false;

  private unsubEphemeral: (() => void) | null = null;
  private unsubDurable: (() => void) | null = null;
  private lifecycleUnsubscribers: (() => void)[] = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(config: MultiplayerRecoveryConfig) {
    this.config = config;
    this.tabId =
      config.tabId ||
      `tab_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  }

  get session(): GameSession | null {
    return this._session;
  }

  get state(): GameState | null {
    return this._state;
  }

  get phase(): GamePhase {
    return this._phase;
  }

  get connectionStatus(): RecoveryConnectionStatus {
    return this._connectionStatus;
  }

  get partnerStatus(): PartnerStatus {
    return this._partnerStatus;
  }

  get isRehydrating(): boolean {
    return this._isRehydrating;
  }

  get isSubmittingAction(): boolean {
    return this._isSubmittingAction;
  }

  /**
   * Initializes coordinator, attaches lifecycle listeners, and triggers authoritative rehydrate.
   */
  async start(): Promise<{ session: GameSession | null; state: GameState | null }> {
    this.setupLifecycleListeners();
    this.setupTabSync();
    return await this.rehydrate("INITIAL_LOAD");
  }

  /**
   * Stops all subscriptions, timers, and lifecycle handlers.
   */
  destroy(): void {
    this.cleanupListeners();
    for (const unsub of this.lifecycleUnsubscribers) {
      try {
        unsub();
      } catch {
        // Cleanup
      }
    }
    this.lifecycleUnsubscribers = [];

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // Cleanup
      }
      this.broadcastChannel = null;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Rehydrates state strictly from the authoritative server source.
   * Discards any stale React or in-memory state.
   */
  async rehydrate(
    reason:
      | "INITIAL_LOAD"
      | "BROWSER_REFRESH"
      | "TAB_RESTORE"
      | "NETWORK_RESTORE"
      | "SLEEP_WAKE"
      | "LISTENER_INTERRUPTED"
      | "WEBRTC_FALLBACK"
      | "TAB_SYNC"
      | "MANUAL" = "MANUAL"
  ): Promise<{ session: GameSession | null; state: GameState | null }> {
    if (this._isRehydrating) {
      return { session: this._session, state: this._state };
    }

    this._isRehydrating = true;
    this.setConnectionStatus("reconnecting");

    try {
      const fetcher =
        this.config.fetchAggregateFn ||
        authoritativeGameClient.fetchGameAggregate.bind(authoritativeGameClient);

      const aggregate = await fetcher(this.config.gameId);

      if (aggregate) {
        this._session = aggregate.session;
        this._state = aggregate.state;
        this.reconcileAuthoritativeState(aggregate.state, aggregate.session, reason);
        this.setConnectionStatus("connected");
      } else {
        // Fallback check if session could not be fetched
        this.setConnectionStatus("disconnected");
      }

      // Re-establish realtime listeners after rehydration
      this.reestablishRealtimeListeners();

      return { session: this._session, state: this._state };
    } catch (err) {
      console.warn(`[MultiplayerRecovery] Rehydration warning (${reason}):`, err);
      this.setConnectionStatus("disconnected");
      return { session: this._session, state: this._state };
    } finally {
      this._isRehydrating = false;
    }
  }

  /**
   * Reconciles authoritative state, computes phase, checks in-flight actions,
   * and dispatches callbacks.
   */
  private reconcileAuthoritativeState(
    nextState: GameState,
    nextSession: GameSession,
    source: string
  ): void {
    const prevPhase = this._phase;
    const nextPhase = computeAuthoritativePhase(nextState, nextSession);
    this._phase = nextPhase;

    // Check partner connection status from server state
    this.evaluatePartnerPresence(nextState, nextSession);

    // Reconcile any in-flight actions that were submitted before/during disconnect
    const reconciledAction = this.reconcileInFlightActions(nextState);

    // If game ended while client was offline / reconnecting
    if (
      (nextState.isFinished || nextState.status === "game_end") &&
      prevPhase !== "game_end"
    ) {
      this.config.onGameEndedWhileOffline?.(nextState);
    }

    if (prevPhase !== nextPhase) {
      this.config.onPhaseChange?.(nextPhase);
    }

    this.config.onStateReconciled?.(
      nextState,
      nextSession,
      nextPhase,
      reconciledAction || undefined
    );

    // Notify other tabs if this tab reconciled to a higher state version
    this.notifyTabsOfStateUpdate(nextState.version);
  }

  /**
   * Reconciles in-flight actions against the authoritative state.
   * Handles actions submitted before disconnect but committed during disconnect.
   */
  reconcileInFlightActions(state: GameState): InFlightActionRecord | null {
    const pending = inFlightActionStorage.getAll(this.config.gameId);
    let resolvedAction: InFlightActionRecord | null = null;

    for (const action of pending) {
      const isCommitted = Boolean(
        state.processedActionIds && state.processedActionIds[action.clientActionId]
      );

      if (isCommitted) {
        action.status = "committed_during_disconnect";
        inFlightActionStorage.remove(this.config.gameId, action.clientActionId);
        resolvedAction = action;
        this.config.onActionCommittedDuringDisconnect?.(action);
      } else if (state.isFinished || state.status === "game_end") {
        action.status = "obsolete";
        inFlightActionStorage.remove(this.config.gameId, action.clientActionId);
      } else if (
        action.targetStateVersion !== undefined &&
        state.version > action.targetStateVersion + 2
      ) {
        // Stale action whose turn or round has expired
        action.status = "obsolete";
        inFlightActionStorage.remove(this.config.gameId, action.clientActionId);
      }
    }

    return resolvedAction;
  }

  /**
   * Submits an authoritative action with full idempotency, duplicate prevention,
   * and in-flight tracking across network disconnects.
   */
  async submitAction(
    type: string,
    payload: unknown = {},
    customUid?: string
  ): Promise<GameActionResult> {
    const actingUid = customUid || this.config.playerId;
    const gameId = this.config.gameId;

    // Prevent duplicate action submission while currently submitting identical action
    const payloadStr = JSON.stringify(payload);
    const existingInFlight = inFlightActionStorage
      .getAll(gameId)
      .find((a) => a.type === type && JSON.stringify(a.payload) === payloadStr);

    if (existingInFlight && this._isSubmittingAction) {
      throw new Error(`Action '${type}' is already in-flight. Duplicate submission prevented.`);
    }

    const clientActionId = `act_${gameId}_${actingUid}_${type}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    const currentVersion = this._state?.version || 1;

    const record: InFlightActionRecord = {
      clientActionId,
      gameId,
      type,
      payload,
      playerId: actingUid,
      submittedAt: Date.now(),
      targetStateVersion: currentVersion,
      status: "pending",
    };

    inFlightActionStorage.set(record);
    this._isSubmittingAction = true;

    const actionPayload: GameAction = {
      gameId,
      clientActionId,
      type,
      payload,
      clientTimestamp: record.submittedAt,
      playerId: actingUid,
    };

    try {
      let result: GameActionResult;
      if (this.config.submitActionFn) {
        result = await this.config.submitActionFn(actionPayload, actingUid);
      } else {
        result = await authoritativeGameClient.submitAction(
          gameId,
          type,
          payload,
          actingUid,
          clientActionId
        );
      }

      record.status = "committed";
      inFlightActionStorage.remove(gameId, clientActionId);

      if (result.gameState && result.gameSession) {
        this._state = result.gameState;
        this._session = result.gameSession;
        this.reconcileAuthoritativeState(result.gameState, result.gameSession, "ACTION_SUCCESS");
      }

      return result;
    } catch (error) {
      // In case of network error, action might have been committed on server!
      // Keep record in storage with status pending for rehydration reconciliation
      const isNetworkError =
        error instanceof TypeError ||
        (error instanceof Error &&
          (error.message.includes("fetch") ||
            error.message.includes("network") ||
            error.message.includes("offline")));

      if (isNetworkError) {
        console.warn(
          `[MultiplayerRecovery] Network interruption during action ${clientActionId}. Queued for rehydration check.`
        );
      } else {
        // Hard failure (validation error, not in game, etc) -> remove from pending
        record.status = "rejected";
        record.error = error instanceof Error ? error.message : String(error);
        inFlightActionStorage.remove(gameId, clientActionId);
      }

      throw error;
    } finally {
      this._isSubmittingAction = false;
    }
  }

  /**
   * Re-establishes live Firebase listeners (RTDB + Firestore) cleanly.
   */
  private reestablishRealtimeListeners(): void {
    this.cleanupListeners();

    const subEphemeral =
      this.config.subscribeEphemeralFn ||
      authoritativeGameClient.subscribeToEphemeralState.bind(authoritativeGameClient);
    const subDurable =
      this.config.subscribeDurableFn ||
      authoritativeGameClient.subscribeToDurableSession.bind(authoritativeGameClient);

    this.unsubEphemeral = subEphemeral(this.config.gameId, (updatedState) => {
      if (updatedState && this._session) {
        this._state = updatedState;
        this.reconcileAuthoritativeState(updatedState, this._session, "EPHEMERAL_UPDATE");
      }
    });

    this.unsubDurable = subDurable(this.config.gameId, (updatedSession) => {
      if (updatedSession && this._state) {
        this._session = updatedSession;
        this.reconcileAuthoritativeState(this._state, updatedSession, "DURABLE_UPDATE");
      }
    });
  }

  private cleanupListeners(): void {
    if (this.unsubEphemeral) {
      try {
        this.unsubEphemeral();
      } catch {
        // Cleanup
      }
      this.unsubEphemeral = null;
    }
    if (this.unsubDurable) {
      try {
        this.unsubDurable();
      } catch {
        // Cleanup
      }
      this.unsubDurable = null;
    }
  }

  /**
   * Sets up system lifecycle listeners (online, offline, visibilitychange, focus, pageshow).
   */
  private setupLifecycleListeners(): void {
    if (typeof window === "undefined") return;

    // 1. Network Online Event
    const onOnline = () => {
      this.setConnectionStatus("connecting");
      this.rehydrate("NETWORK_RESTORE");
    };

    // 2. Network Offline Event
    const onOffline = () => {
      this.setConnectionStatus("disconnected");
    };

    // 3. Tab Visibility Change (Tab restore, laptop lid open, focus return)
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        this.rehydrate("TAB_RESTORE");
      }
    };

    // 4. Focus Event
    const onFocus = () => {
      if (this._connectionStatus === "disconnected") {
        this.rehydrate("SLEEP_WAKE");
      }
    };

    // 5. Page Show (bfcache restoration)
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        this.rehydrate("BROWSER_REFRESH");
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    this.lifecycleUnsubscribers.push(() => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    });

    // Authoritative periodic heartbeat / backup poll (every 3 seconds)
    this.pollInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      this.pollAuthoritativeDrift();
    }, 3000);
  }

  /**
   * Checks for background drift or dropped WebSocket packets.
   */
  private async pollAuthoritativeDrift(): Promise<void> {
    try {
      const fetcher =
        this.config.fetchAggregateFn ||
        authoritativeGameClient.fetchGameAggregate.bind(authoritativeGameClient);
      const agg = await fetcher(this.config.gameId);
      if (agg && this._state) {
        if (agg.state.version > this._state.version || agg.state.status !== this._state.status) {
          this._session = agg.session;
          this._state = agg.state;
          this.reconcileAuthoritativeState(agg.state, agg.session, "DRIFT_POLL");
        }
      }
    } catch {
      // Ignored in background poll
    }
  }

  /**
   * Multi-Tab Synchronization:
   * Coordinates multiple tabs for the same user via BroadcastChannel or storage events.
   */
  private setupTabSync(): void {
    if (typeof window === "undefined" || this.config.enableTabSync === false) return;

    // Use BroadcastChannel if available
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel(`tp_sync_${this.config.gameId}`);
        this.broadcastChannel.onmessage = (ev) => {
          const data = ev.data as { type: string; version: number; fromTabId: string };
          if (data && data.type === "STATE_VERSION" && data.fromTabId !== this.tabId) {
            if (!this._state || data.version > this._state.version) {
              this.rehydrate("TAB_SYNC");
            }
          }
        };
      } catch {
        // Fallback
      }
    }

    // Storage event fallback for cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === `tp_tab_version_${this.config.gameId}` && e.newValue) {
        const version = parseInt(e.newValue, 10);
        if (this._state && version > this._state.version) {
          this.rehydrate("TAB_SYNC");
        }
      }
    };
    window.addEventListener("storage", onStorage);
    this.lifecycleUnsubscribers.push(() => window.removeEventListener("storage", onStorage));
  }

  private notifyTabsOfStateUpdate(version: number): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: "STATE_VERSION",
          version,
          fromTabId: this.tabId,
        });
      } catch {
        // Ignored
      }
    }

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(
          `tp_tab_version_${this.config.gameId}`,
          String(version)
        );
      } catch {
        // Ignored
      }
    }
  }

  private evaluatePartnerPresence(state: GameState, session: GameSession): void {
    const partnerId = session.playerIds.find((p) => p !== this.config.playerId);
    if (!partnerId) return;

    // Check race player connectionStatus if couple_race
    const racePlayers = (state.data?.players || {}) as Record<string, { connectionStatus?: string }>;
    const partnerRace = racePlayers[partnerId];

    let newPartnerStatus: PartnerStatus = "connected";
    if (partnerRace?.connectionStatus === "disconnected") {
      newPartnerStatus = "reconnecting";
    }

    if (this._partnerStatus !== newPartnerStatus) {
      this._partnerStatus = newPartnerStatus;
      this.config.onPartnerConnectionChange?.(newPartnerStatus);
    }
  }

  private setConnectionStatus(status: RecoveryConnectionStatus): void {
    if (this._connectionStatus !== status) {
      this._connectionStatus = status;
      this.config.onConnectionStatusChange?.(status);
    }
  }
}
