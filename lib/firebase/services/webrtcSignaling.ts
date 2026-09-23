/**
 * TogetherPlay WebRTC Signaling Service via Firebase Realtime Database
 * 
 * ARCHITECTURE PRINCIPLES & PRIVACY DIRECTIVES:
 * - Firebase Realtime Database is used strictly for signaling (SDP offers, answers, ICE candidates, participant presence).
 * - NEVER store, record, transcribe, or upload audio/video streams.
 * - All audio and video tracks flow strictly peer-to-peer between client browsers over encrypted WebRTC (SRTP/DTLS).
 * - Signaling listeners and data nodes are promptly cleaned up on call leave or disconnect.
 */

import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onChildAdded,
  off,
  push,
} from "firebase/database";
import { rtdb, auth } from "../client";
import type {
  WebRtcParticipant,
  WebRtcSignalOffer,
  WebRtcSignalAnswer,
  WebRtcSignalCandidate,
} from "@/types/domain";

export type SignalingSecurityErrorCode =
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "INVALID_ROOM"
  | "PERMISSION_DENIED"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "WRONG_PARTICIPANT"
  | "STALE_ROOM";

export class SignalingSecurityError extends Error {
  constructor(
    message: string,
    public readonly code: SignalingSecurityErrorCode
  ) {
    super(message);
    this.name = "SignalingSecurityError";
  }
}

export const MAX_SDP_PAYLOAD_CHARS = 32768; // 32 KB maximum for SDP
export const MAX_ICE_CANDIDATE_CHARS = 2048; // 2 KB maximum for ICE candidate string
export const MAX_CANDIDATES_PER_SESSION = 100; // max candidates per peer session
export const MAX_WRITES_PER_MINUTE = 60; // rate limit: max writes per minute
export const MAX_STALE_ROOM_AGE_MS = 15 * 60 * 1000; // 15 minutes max room activity threshold

export interface SignalingServiceContract {
  publishParticipant(roomId: string, participant: WebRtcParticipant): Promise<void>;
  updateParticipant(roomId: string, userId: string, updates: Partial<WebRtcParticipant>): Promise<void>;
  removeParticipant(roomId: string, userId: string): Promise<void>;
  subscribeToParticipants(
    roomId: string,
    callback: (participants: Record<string, WebRtcParticipant>) => void,
    subscriberUserId?: string
  ): () => void;
  sendOffer(roomId: string, offer: WebRtcSignalOffer): Promise<void>;
  subscribeToOffers(
    roomId: string,
    myUserId: string,
    callback: (offer: WebRtcSignalOffer | null) => void
  ): () => void;
  sendAnswer(roomId: string, answer: WebRtcSignalAnswer): Promise<void>;
  subscribeToAnswers(
    roomId: string,
    myUserId: string,
    callback: (answer: WebRtcSignalAnswer | null) => void
  ): () => void;
  sendIceCandidate(roomId: string, candidate: WebRtcSignalCandidate): Promise<void>;
  subscribeToIceCandidates(
    roomId: string,
    myUserId: string,
    callback: (candidate: WebRtcSignalCandidate) => void
  ): () => void;
  clearRoomSignaling(roomId: string, myUserId: string): Promise<void>;
  cleanupTransientSignaling(roomId: string, myUserId: string): Promise<void>;
  cleanStaleRoomSignaling(roomId: string, maxAgeMs?: number): Promise<{ cleaned: boolean }>;
}

// In-memory signaling bus for local simulation, dual browser testing, or offline test harnesses
class MemorySignalingBus {
  private participants = new Map<string, Map<string, WebRtcParticipant>>();
  private offers = new Map<string, Map<string, WebRtcSignalOffer>>();
  private answers = new Map<string, Map<string, WebRtcSignalAnswer>>();
  private candidates = new Map<string, Map<string, WebRtcSignalCandidate[]>>();
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private authorizedRooms = new Map<string, Set<string>>();
  private strictAuthorization = false;
  private roomActivity = new Map<string, number>();
  private staleRooms = new Set<string>();
  private writeTimestamps = new Map<string, number[]>();
  private candidateCounts = new Map<string, number>();

  setStrictAuthorization(enabled: boolean) {
    this.strictAuthorization = enabled;
  }

  authorizeRoomUsers(roomId: string, userIds: string[]) {
    if (!this.authorizedRooms.has(roomId)) {
      this.authorizedRooms.set(roomId, new Set());
    }
    const set = this.authorizedRooms.get(roomId)!;
    userIds.forEach((id) => set.add(id));
    this.touchRoom(roomId);
  }

  revokeRoom(roomId: string) {
    this.authorizedRooms.delete(roomId);
    this.roomActivity.delete(roomId);
    this.staleRooms.delete(roomId);
  }

  isUserAuthorized(roomId: string, userId: string): boolean {
    if (this.authorizedRooms.has(roomId)) {
      return this.authorizedRooms.get(roomId)!.has(userId);
    }
    if (this.strictAuthorization || this.authorizedRooms.size > 0) {
      return false;
    }
    return true;
  }

  touchRoom(roomId: string, timestamp = Date.now()): void {
    this.roomActivity.set(roomId, timestamp);
    this.staleRooms.delete(roomId);
  }

  markRoomStale(roomId: string, stale = true): void {
    if (stale) {
      this.staleRooms.add(roomId);
    } else {
      this.staleRooms.delete(roomId);
      this.touchRoom(roomId);
    }
  }

  setRoomStale(roomId: string, stale: boolean): void {
    if (stale) {
      this.staleRooms.add(roomId);
    } else {
      this.staleRooms.delete(roomId);
      this.touchRoom(roomId);
    }
  }

  setRoomActivity(roomId: string, timestamp: number): void {
    this.roomActivity.set(roomId, timestamp);
  }

  isRoomStale(roomId: string, maxAgeMs = MAX_STALE_ROOM_AGE_MS): boolean {
    if (this.staleRooms.has(roomId)) {
      return true;
    }
    const lastActivity = this.roomActivity.get(roomId);
    if (lastActivity !== undefined) {
      return Date.now() - lastActivity > maxAgeMs;
    }
    return false;
  }

  checkWriteLimits(roomId: string, userId: string, isCandidate = false): void {
    const key = `${roomId}:${userId}`;
    const now = Date.now();
    const windowMs = 60 * 1000;

    let timestamps = this.writeTimestamps.get(key) || [];
    timestamps = timestamps.filter((t) => now - t < windowMs);

    if (timestamps.length >= MAX_WRITES_PER_MINUTE) {
      throw new SignalingSecurityError(
        `Signaling write limit exceeded (${MAX_WRITES_PER_MINUTE} writes/min). Request rejected.`,
        "RATE_LIMITED"
      );
    }

    if (isCandidate) {
      const count = (this.candidateCounts.get(key) || 0) + 1;
      if (count > MAX_CANDIDATES_PER_SESSION) {
        throw new SignalingSecurityError(
          `ICE candidate limit exceeded for this session (max ${MAX_CANDIDATES_PER_SESSION} candidates).`,
          "RATE_LIMITED"
        );
      }
      this.candidateCounts.set(key, count);
    }

    timestamps.push(now);
    this.writeTimestamps.set(key, timestamps);
    this.touchRoom(roomId, now);
  }

  cleanStaleRoom(roomId: string, maxAgeMs = MAX_STALE_ROOM_AGE_MS): boolean {
    if (this.isRoomStale(roomId, maxAgeMs)) {
      this.participants.delete(roomId);
      this.offers.delete(roomId);
      this.answers.delete(roomId);
      this.candidates.delete(roomId);
      this.roomActivity.delete(roomId);
      this.staleRooms.add(roomId);
      this.broadcastParticipants(roomId);
      return true;
    }
    return false;
  }

  resetRateLimits(): void {
    this.writeTimestamps.clear();
    this.candidateCounts.clear();
  }

  resetMinuteLimits(): void {
    this.writeTimestamps.clear();
  }

  private getChannelKey(type: string, roomId: string, extra = ""): string {
    return `${type}:${roomId}:${extra}`;
  }

  notify(channel: string, data: unknown) {
    const subs = this.listeners.get(channel);
    if (subs) {
      subs.forEach((cb) => cb(data));
    }
  }

  subscribe(channel: string, cb: (data: unknown) => void): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(cb);
    return () => {
      this.listeners.get(channel)?.delete(cb);
    };
  }

  setParticipant(roomId: string, participant: WebRtcParticipant) {
    if (!this.participants.has(roomId)) {
      this.participants.set(roomId, new Map());
    }
    this.participants.get(roomId)!.set(participant.userId, { ...participant });
    this.broadcastParticipants(roomId);
  }

  updateParticipant(roomId: string, userId: string, updates: Partial<WebRtcParticipant>) {
    const room = this.participants.get(roomId);
    if (room && room.has(userId)) {
      const current = room.get(userId)!;
      room.set(userId, { ...current, ...updates, updatedAt: Date.now() });
      this.broadcastParticipants(roomId);
    }
  }

  removeParticipant(roomId: string, userId: string) {
    const room = this.participants.get(roomId);
    if (room) {
      room.delete(userId);
      this.broadcastParticipants(roomId);
    }
  }

  private broadcastParticipants(roomId: string) {
    const room = this.participants.get(roomId);
    const obj: Record<string, WebRtcParticipant> = {};
    if (room) {
      room.forEach((v, k) => {
        obj[k] = { ...v };
      });
    }
    this.notify(this.getChannelKey("participants", roomId), obj);
  }

  getParticipants(roomId: string): Record<string, WebRtcParticipant> {
    const room = this.participants.get(roomId);
    const obj: Record<string, WebRtcParticipant> = {};
    if (room) {
      room.forEach((v, k) => {
        obj[k] = { ...v };
      });
    }
    return obj;
  }

  setOffer(roomId: string, offer: WebRtcSignalOffer) {
    if (!this.offers.has(roomId)) {
      this.offers.set(roomId, new Map());
    }
    this.offers.get(roomId)!.set(offer.toUserId, { ...offer });
    this.notify(this.getChannelKey("offer", roomId, offer.toUserId), { ...offer });
  }

  setAnswer(roomId: string, answer: WebRtcSignalAnswer) {
    if (!this.answers.has(roomId)) {
      this.answers.set(roomId, new Map());
    }
    this.answers.get(roomId)!.set(answer.toUserId, { ...answer });
    this.notify(this.getChannelKey("answer", roomId, answer.toUserId), { ...answer });
  }

  addCandidate(roomId: string, candidate: WebRtcSignalCandidate) {
    if (!this.candidates.has(roomId)) {
      this.candidates.set(roomId, new Map());
    }
    const room = this.candidates.get(roomId)!;
    if (!room.has(candidate.toUserId)) {
      room.set(candidate.toUserId, []);
    }
    room.get(candidate.toUserId)!.push({ ...candidate });
    this.notify(this.getChannelKey("candidate", roomId, candidate.toUserId), { ...candidate });
  }

  getOffer(roomId: string, toUserId: string): WebRtcSignalOffer | null {
    return this.offers.get(roomId)?.get(toUserId) || null;
  }

  getAnswer(roomId: string, toUserId: string): WebRtcSignalAnswer | null {
    return this.answers.get(roomId)?.get(toUserId) || null;
  }

  clearRoomUser(roomId: string, userId: string) {
    this.removeParticipant(roomId, userId);
    this.offers.get(roomId)?.delete(userId);
    this.notify(this.getChannelKey("offer", roomId, userId), null);
    this.answers.get(roomId)?.delete(userId);
    this.notify(this.getChannelKey("answer", roomId, userId), null);
    this.candidates.get(roomId)?.delete(userId);
    this.notify(this.getChannelKey("candidate", roomId, userId), null);
  }

  clearTransientSignaling(roomId: string, userId: string) {
    this.offers.get(roomId)?.delete(userId);
    this.notify(this.getChannelKey("offer", roomId, userId), null);
    this.answers.get(roomId)?.delete(userId);
    this.notify(this.getChannelKey("answer", roomId, userId), null);
    this.candidates.get(roomId)?.delete(userId);
    this.notify(this.getChannelKey("candidate", roomId, userId), null);
  }

  resetAll() {
    this.participants.clear();
    this.offers.clear();
    this.answers.clear();
    this.candidates.clear();
    this.listeners.clear();
    this.authorizedRooms.clear();
    this.strictAuthorization = false;
    this.roomActivity.clear();
    this.staleRooms.clear();
    this.writeTimestamps.clear();
    this.candidateCounts.clear();
  }
}

export const memorySignalingBus = new MemorySignalingBus();

function withTimeout<T>(promise: Promise<T>, ms = 800): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("RTDB timeout")), ms)),
  ]);
}

export class FirebaseWebRtcSignalingService implements SignalingServiceContract {
  private hasRtdb(): boolean {
    if (typeof window === "undefined" || process.env.NODE_ENV === "test") {
      return false;
    }
    return Boolean(rtdb);
  }

  /**
   * Validates SDP and ICE candidate payload sizes.
   * Does NOT log or leak payload contents.
   */
  public validatePayloadSize(payload: unknown, type: "offer" | "answer" | "candidate"): void {
    if (!payload || typeof payload !== "object") {
      throw new SignalingSecurityError("Signaling payload must be a non-null object.", "PAYLOAD_TOO_LARGE");
    }

    const pRecord = payload as { timestamp?: unknown };
    if (typeof pRecord.timestamp === "number") {
      const now = Date.now();
      const age = now - pRecord.timestamp;
      if (age > MAX_STALE_ROOM_AGE_MS || age < -300000) {
        throw new SignalingSecurityError(
          "Signaling payload timestamp is expired, stale, or invalid.",
          "STALE_ROOM"
        );
      }
    }

    if (type === "offer" || type === "answer") {
      const p = payload as { sdp?: unknown };
      let sdpLength = 0;
      if (typeof p.sdp === "string") {
        sdpLength = p.sdp.length;
      } else if (typeof p.sdp === "object" && p.sdp !== null && "sdp" in p.sdp) {
        sdpLength = String((p.sdp as { sdp: unknown }).sdp || "").length;
      } else {
        throw new SignalingSecurityError("SDP session description is missing or invalid.", "PAYLOAD_TOO_LARGE");
      }

      if (sdpLength > MAX_SDP_PAYLOAD_CHARS) {
        throw new SignalingSecurityError(
          `SDP payload size exceeds maximum allowed limit of ${MAX_SDP_PAYLOAD_CHARS} characters.`,
          "PAYLOAD_TOO_LARGE"
        );
      }
    } else if (type === "candidate") {
      const c = payload as { candidate?: unknown };
      let candLength = 0;
      if (typeof c.candidate === "string") {
        candLength = c.candidate.length;
      } else if (typeof c.candidate === "object" && c.candidate !== null && "candidate" in c.candidate) {
        candLength = String((c.candidate as { candidate: unknown }).candidate || "").length;
      } else {
        throw new SignalingSecurityError("ICE candidate description is missing or invalid.", "PAYLOAD_TOO_LARGE");
      }

      if (candLength > MAX_ICE_CANDIDATE_CHARS) {
        throw new SignalingSecurityError(
          `ICE candidate payload size exceeds maximum allowed limit of ${MAX_ICE_CANDIDATE_CHARS} characters.`,
          "PAYLOAD_TOO_LARGE"
        );
      }
    }
  }

  /**
   * Validates target recipient in the signaling room.
   */
  public verifyRecipient(roomId: string, fromUserId: string, toUserId: string): void {
    if (!toUserId || typeof toUserId !== "string" || toUserId.trim() === "") {
      throw new SignalingSecurityError("Target recipient user ID is required.", "WRONG_PARTICIPANT");
    }
    if (fromUserId === toUserId) {
      throw new SignalingSecurityError("Signaling sender and recipient cannot be the same participant.", "WRONG_PARTICIPANT");
    }
    if (!memorySignalingBus.isUserAuthorized(roomId, toUserId)) {
      throw new SignalingSecurityError(
        `Recipient '${toUserId}' is not an authorized participant in room '${roomId}'.`,
        "WRONG_PARTICIPANT"
      );
    }
  }

  /**
   * Validates participant identity against the authenticated Firebase Auth session.
   */
  public verifyIdentity(userId: string): void {
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      throw new SignalingSecurityError("User ID is required for WebRTC signaling.", "UNAUTHORIZED");
    }

    if (typeof window !== "undefined" && auth?.currentUser) {
      if (auth.currentUser.uid !== userId) {
        throw new SignalingSecurityError(
          `Signaling identity mismatch: authenticated UID '${auth.currentUser.uid}' does not match requested '${userId}'.`,
          "UNAUTHENTICATED"
        );
      }
    }
  }

  /**
   * Validates that the user is authorized for the given signaling room.
   */
  public verifyRoomAuthorization(roomId: string, userId: string): void {
    if (!roomId || typeof roomId !== "string" || roomId.trim() === "") {
      throw new SignalingSecurityError("Invalid room ID for WebRTC signaling.", "INVALID_ROOM");
    }
    this.verifyIdentity(userId);

    if (memorySignalingBus.isRoomStale(roomId)) {
      throw new SignalingSecurityError(
        `Signaling room '${roomId}' is stale or expired. Signaling rejected.`,
        "STALE_ROOM"
      );
    }

    if (!memorySignalingBus.isUserAuthorized(roomId, userId)) {
      throw new SignalingSecurityError(
        `User '${userId}' is not authorized to access signaling in room '${roomId}'.`,
        "UNAUTHORIZED"
      );
    }
  }

  /**
   * Registers or updates participant presence in the signaling room.
   */
  async publishParticipant(roomId: string, participant: WebRtcParticipant): Promise<void> {
    this.verifyRoomAuthorization(roomId, participant.userId);

    const existing = memorySignalingBus.getParticipants(roomId);
    const existingIds = Object.keys(existing);
    if (!existingIds.includes(participant.userId) && existingIds.length >= 2) {
      throw new SignalingSecurityError(
        `Room '${roomId}' has reached maximum participant capacity (2).`,
        "UNAUTHORIZED"
      );
    }

    memorySignalingBus.checkWriteLimits(roomId, participant.userId, false);
    memorySignalingBus.setParticipant(roomId, participant);
    if (this.hasRtdb()) {
      try {
        const participantRef = ref(rtdb, `webrtc_signaling/${roomId}/participants/${participant.userId}`);
        await withTimeout(set(participantRef, participant));
      } catch (err) {
        console.warn("[Signaling] RTDB publishParticipant fallback to memory:", err);
      }
    }
  }

  /**
   * Updates partial state (e.g. cameraEnabled, micEnabled) for a participant.
   */
  async updateParticipant(
    roomId: string,
    userId: string,
    updates: Partial<WebRtcParticipant>
  ): Promise<void> {
    this.verifyRoomAuthorization(roomId, userId);
    memorySignalingBus.checkWriteLimits(roomId, userId, false);
    memorySignalingBus.updateParticipant(roomId, userId, updates);
    if (this.hasRtdb()) {
      try {
        const participantRef = ref(rtdb, `webrtc_signaling/${roomId}/participants/${userId}`);
        await withTimeout(
          update(participantRef, {
            ...updates,
            updatedAt: Date.now(),
          })
        );
      } catch (err) {
        console.warn("[Signaling] RTDB updateParticipant fallback to memory:", err);
      }
    }
  }

  /**
   * Removes participant upon leaving the video call.
   */
  async removeParticipant(roomId: string, userId: string): Promise<void> {
    this.verifyRoomAuthorization(roomId, userId);
    memorySignalingBus.removeParticipant(roomId, userId);
    if (this.hasRtdb()) {
      try {
        const participantRef = ref(rtdb, `webrtc_signaling/${roomId}/participants/${userId}`);
        await withTimeout(remove(participantRef));
      } catch (err) {
        console.warn("[Signaling] RTDB removeParticipant fallback to memory:", err);
      }
    }
  }

  /**
   * Subscribes to participants present in the video room.
   */
  subscribeToParticipants(
    roomId: string,
    callback: (participants: Record<string, WebRtcParticipant>) => void,
    subscriberUserId?: string
  ): () => void {
    if (subscriberUserId) {
      this.verifyRoomAuthorization(roomId, subscriberUserId);
    }
    const memoryUnsub = memorySignalingBus.subscribe(`participants:${roomId}:`, (data) => {
      callback(data as Record<string, WebRtcParticipant>);
    });

    // Provide immediate memory data
    callback(memorySignalingBus.getParticipants(roomId));

    let rtdbCallback: ((snap: unknown) => void) | null = null;
    let participantsRef: unknown = null;

    if (this.hasRtdb()) {
      try {
        participantsRef = ref(rtdb, `webrtc_signaling/${roomId}/participants`);
        rtdbCallback = onValue(
          participantsRef as ReturnType<typeof ref>,
          (snapshot) => {
            if (snapshot.exists()) {
              callback(snapshot.val() as Record<string, WebRtcParticipant>);
            } else {
              callback({});
            }
          },
          (err) => {
            console.warn("[Signaling] RTDB participants subscription warning:", err);
          }
        );
      } catch (err) {
        console.warn("[Signaling] RTDB subscribeToParticipants fallback:", err);
      }
    }

    return () => {
      memoryUnsub();
      if (rtdbCallback && participantsRef) {
        try {
          off(participantsRef as ReturnType<typeof ref>, "value", rtdbCallback);
        } catch {
          // ignore
        }
      }
    };
  }

  /**
   * Sends an SDP offer to a specific peer.
   * Enforces payload size, recipient validity, and write limits.
   */
  async sendOffer(roomId: string, offer: WebRtcSignalOffer): Promise<void> {
    this.verifyRoomAuthorization(roomId, offer.fromUserId);
    this.verifyRecipient(roomId, offer.fromUserId, offer.toUserId);
    this.validatePayloadSize(offer, "offer");
    memorySignalingBus.checkWriteLimits(roomId, offer.fromUserId, false);

    memorySignalingBus.setOffer(roomId, offer);
    if (this.hasRtdb()) {
      try {
        const offerRef = ref(rtdb, `webrtc_signaling/${roomId}/offers/${offer.toUserId}`);
        await withTimeout(set(offerRef, offer));
      } catch (err) {
        console.warn("[Signaling] RTDB sendOffer fallback to memory:", err);
      }
    }
  }

  /**
   * Subscribes to incoming offers addressed to this user.
   */
  subscribeToOffers(
    roomId: string,
    myUserId: string,
    callback: (offer: WebRtcSignalOffer | null) => void
  ): () => void {
    this.verifyRoomAuthorization(roomId, myUserId);
    const initialOffer = memorySignalingBus.getOffer(roomId, myUserId);
    callback(initialOffer);
    const memoryUnsub = memorySignalingBus.subscribe(`offer:${roomId}:${myUserId}`, (data) => {
      callback(data as WebRtcSignalOffer | null);
    });

    let rtdbCallback: ((snap: unknown) => void) | null = null;
    let offerRef: unknown = null;

    if (this.hasRtdb()) {
      try {
        offerRef = ref(rtdb, `webrtc_signaling/${roomId}/offers/${myUserId}`);
        rtdbCallback = onValue(
          offerRef as ReturnType<typeof ref>,
          (snapshot) => {
            if (snapshot.exists()) {
              callback(snapshot.val() as WebRtcSignalOffer);
            } else {
              callback(null);
            }
          },
          (err) => {
            console.warn("[Signaling] RTDB offers subscription warning:", err);
          }
        );
      } catch (err) {
        console.warn("[Signaling] RTDB subscribeToOffers fallback:", err);
      }
    }

    return () => {
      memoryUnsub();
      if (rtdbCallback && offerRef) {
        try {
          off(offerRef as ReturnType<typeof ref>, "value", rtdbCallback);
        } catch {
          // ignore
        }
      }
    };
  }

  /**
   * Sends an SDP answer to the offering peer.
   * Enforces payload size, recipient validity, and write limits.
   */
  async sendAnswer(roomId: string, answer: WebRtcSignalAnswer): Promise<void> {
    this.verifyRoomAuthorization(roomId, answer.fromUserId);
    this.verifyRecipient(roomId, answer.fromUserId, answer.toUserId);
    this.validatePayloadSize(answer, "answer");
    memorySignalingBus.checkWriteLimits(roomId, answer.fromUserId, false);

    memorySignalingBus.setAnswer(roomId, answer);
    if (this.hasRtdb()) {
      try {
        const answerRef = ref(rtdb, `webrtc_signaling/${roomId}/answers/${answer.toUserId}`);
        await withTimeout(set(answerRef, answer));
      } catch (err) {
        console.warn("[Signaling] RTDB sendAnswer fallback to memory:", err);
      }
    }
  }

  /**
   * Subscribes to incoming answers addressed to this user.
   */
  subscribeToAnswers(
    roomId: string,
    myUserId: string,
    callback: (answer: WebRtcSignalAnswer | null) => void
  ): () => void {
    this.verifyRoomAuthorization(roomId, myUserId);
    const initialAnswer = memorySignalingBus.getAnswer(roomId, myUserId);
    callback(initialAnswer);
    const memoryUnsub = memorySignalingBus.subscribe(`answer:${roomId}:${myUserId}`, (data) => {
      callback(data as WebRtcSignalAnswer | null);
    });

    let rtdbCallback: ((snap: unknown) => void) | null = null;
    let answerRef: unknown = null;

    if (this.hasRtdb()) {
      try {
        answerRef = ref(rtdb, `webrtc_signaling/${roomId}/answers/${myUserId}`);
        rtdbCallback = onValue(
          answerRef as ReturnType<typeof ref>,
          (snapshot) => {
            if (snapshot.exists()) {
              callback(snapshot.val() as WebRtcSignalAnswer);
            } else {
              callback(null);
            }
          },
          (err) => {
            console.warn("[Signaling] RTDB answers subscription warning:", err);
          }
        );
      } catch (err) {
        console.warn("[Signaling] RTDB subscribeToAnswers fallback:", err);
      }
    }

    return () => {
      memoryUnsub();
      if (rtdbCallback && answerRef) {
        try {
          off(answerRef as ReturnType<typeof ref>, "value", rtdbCallback);
        } catch {
          // ignore
        }
      }
    };
  }

  /**
   * Pushes a local ICE candidate for the partner.
   * Enforces payload size, recipient validity, and candidate count limits.
   */
  async sendIceCandidate(roomId: string, candidate: WebRtcSignalCandidate): Promise<void> {
    this.verifyRoomAuthorization(roomId, candidate.fromUserId);
    this.verifyRecipient(roomId, candidate.fromUserId, candidate.toUserId);
    this.validatePayloadSize(candidate, "candidate");
    memorySignalingBus.checkWriteLimits(roomId, candidate.fromUserId, true);

    memorySignalingBus.addCandidate(roomId, candidate);
    if (this.hasRtdb()) {
      try {
        const candidatesRef = ref(rtdb, `webrtc_signaling/${roomId}/candidates/${candidate.toUserId}`);
        const newCandidateRef = push(candidatesRef);
        await withTimeout(set(newCandidateRef, candidate));
      } catch (err) {
        console.warn("[Signaling] RTDB sendIceCandidate fallback to memory:", err);
      }
    }
  }

  /**
   * Subscribes to incoming ICE candidates for this user.
   */
  subscribeToIceCandidates(
    roomId: string,
    myUserId: string,
    callback: (candidate: WebRtcSignalCandidate) => void
  ): () => void {
    this.verifyRoomAuthorization(roomId, myUserId);
    const memoryUnsub = memorySignalingBus.subscribe(`candidate:${roomId}:${myUserId}`, (data) => {
      callback(data as WebRtcSignalCandidate);
    });

    let rtdbCallback: ((snap: unknown) => void) | null = null;
    let candidatesRef: unknown = null;

    if (this.hasRtdb()) {
      try {
        candidatesRef = ref(rtdb, `webrtc_signaling/${roomId}/candidates/${myUserId}`);
        rtdbCallback = onChildAdded(
          candidatesRef as ReturnType<typeof ref>,
          (snapshot) => {
            if (snapshot.exists()) {
              callback(snapshot.val() as WebRtcSignalCandidate);
            }
          },
          (err) => {
            console.warn("[Signaling] RTDB candidates subscription warning:", err);
          }
        );
      } catch (err) {
        console.warn("[Signaling] RTDB subscribeToIceCandidates fallback:", err);
      }
    }

    return () => {
      memoryUnsub();
      if (rtdbCallback && candidatesRef) {
        try {
          off(candidatesRef as ReturnType<typeof ref>, "child_added", rtdbCallback);
        } catch {
          // ignore
        }
      }
    };
  }

  /**
   * Completely clears signaling entries for the leaving user.
   */
  async clearRoomSignaling(roomId: string, myUserId: string): Promise<void> {
    this.verifyRoomAuthorization(roomId, myUserId);
    memorySignalingBus.clearRoomUser(roomId, myUserId);
    if (this.hasRtdb()) {
      try {
        const participantRef = ref(rtdb, `webrtc_signaling/${roomId}/participants/${myUserId}`);
        const offersRef = ref(rtdb, `webrtc_signaling/${roomId}/offers/${myUserId}`);
        const answersRef = ref(rtdb, `webrtc_signaling/${roomId}/answers/${myUserId}`);
        const candidatesRef = ref(rtdb, `webrtc_signaling/${roomId}/candidates/${myUserId}`);

        await Promise.allSettled([
          withTimeout(remove(participantRef)),
          withTimeout(remove(offersRef)),
          withTimeout(remove(answersRef)),
          withTimeout(remove(candidatesRef)),
        ]);
      } catch (err) {
        console.warn("[Signaling] RTDB clearRoomSignaling fallback:", err);
      }
    }
  }

  /**
   * Cleans transient signaling payloads (offers, answers, candidates) once connection is established,
   * keeping participant presence active. Prevents accumulation of stale signaling data.
   */
  async cleanupTransientSignaling(roomId: string, myUserId: string): Promise<void> {
    this.verifyRoomAuthorization(roomId, myUserId);
    memorySignalingBus.clearTransientSignaling(roomId, myUserId);
    if (this.hasRtdb()) {
      try {
        const offersRef = ref(rtdb, `webrtc_signaling/${roomId}/offers/${myUserId}`);
        const answersRef = ref(rtdb, `webrtc_signaling/${roomId}/answers/${myUserId}`);
        const candidatesRef = ref(rtdb, `webrtc_signaling/${roomId}/candidates/${myUserId}`);

        await Promise.allSettled([
          withTimeout(remove(offersRef)),
          withTimeout(remove(answersRef)),
          withTimeout(remove(candidatesRef)),
        ]);
      } catch (err) {
        console.warn("[Signaling] RTDB cleanupTransientSignaling fallback:", err);
      }
    }
  }

  /**
   * Purges stale signaling data older than maxAgeMs from memory and RTDB.
   */
  async cleanStaleRoomSignaling(
    roomId: string,
    maxAgeMs = MAX_STALE_ROOM_AGE_MS
  ): Promise<{ cleaned: boolean }> {
    if (!roomId || typeof roomId !== "string" || roomId.trim() === "") {
      throw new SignalingSecurityError("Invalid room ID for WebRTC signaling cleanup.", "INVALID_ROOM");
    }
    const isStale = memorySignalingBus.isRoomStale(roomId, maxAgeMs);
    if (!isStale) {
      return { cleaned: false };
    }
    memorySignalingBus.cleanStaleRoom(roomId, maxAgeMs);
    if (this.hasRtdb()) {
      try {
        const roomRef = ref(rtdb, `webrtc_signaling/${roomId}`);
        await withTimeout(remove(roomRef));
      } catch (err) {
        console.warn("[Signaling] RTDB cleanStaleRoomSignaling fallback:", err);
      }
    }
    return { cleaned: true };
  }
}

export const webrtcSignalingService = new FirebaseWebRtcSignalingService();

