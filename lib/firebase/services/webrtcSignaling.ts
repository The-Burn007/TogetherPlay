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
import { rtdb } from "../client";
import type {
  WebRtcParticipant,
  WebRtcSignalOffer,
  WebRtcSignalAnswer,
  WebRtcSignalCandidate,
} from "@/types/domain";

export interface SignalingServiceContract {
  publishParticipant(roomId: string, participant: WebRtcParticipant): Promise<void>;
  updateParticipant(roomId: string, userId: string, updates: Partial<WebRtcParticipant>): Promise<void>;
  removeParticipant(roomId: string, userId: string): Promise<void>;
  subscribeToParticipants(
    roomId: string,
    callback: (participants: Record<string, WebRtcParticipant>) => void
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
}

// In-memory signaling bus for local simulation, dual browser testing, or offline test harnesses
class MemorySignalingBus {
  private participants = new Map<string, Map<string, WebRtcParticipant>>();
  private offers = new Map<string, Map<string, WebRtcSignalOffer>>();
  private answers = new Map<string, Map<string, WebRtcSignalAnswer>>();
  private candidates = new Map<string, Map<string, WebRtcSignalCandidate[]>>();
  private listeners = new Map<string, Set<(data: unknown) => void>>();

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

  clearRoomUser(roomId: string, userId: string) {
    this.removeParticipant(roomId, userId);
    this.offers.get(roomId)?.delete(userId);
    this.answers.get(roomId)?.delete(userId);
    this.candidates.get(roomId)?.delete(userId);
  }

  resetAll() {
    this.participants.clear();
    this.offers.clear();
    this.answers.clear();
    this.candidates.clear();
    this.listeners.clear();
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
   * Registers or updates participant presence in the signaling room.
   */
  async publishParticipant(roomId: string, participant: WebRtcParticipant): Promise<void> {
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
    callback: (participants: Record<string, WebRtcParticipant>) => void
  ): () => void {
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
   */
  async sendOffer(roomId: string, offer: WebRtcSignalOffer): Promise<void> {
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
    const memoryUnsub = memorySignalingBus.subscribe(`offer:${roomId}:${myUserId}`, (data) => {
      callback(data as WebRtcSignalOffer);
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
   */
  async sendAnswer(roomId: string, answer: WebRtcSignalAnswer): Promise<void> {
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
    const memoryUnsub = memorySignalingBus.subscribe(`answer:${roomId}:${myUserId}`, (data) => {
      callback(data as WebRtcSignalAnswer);
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
   */
  async sendIceCandidate(roomId: string, candidate: WebRtcSignalCandidate): Promise<void> {
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
}

export const webrtcSignalingService = new FirebaseWebRtcSignalingService();
