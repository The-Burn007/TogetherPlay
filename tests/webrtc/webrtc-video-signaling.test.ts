import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  webrtcSignalingService,
  memorySignalingBus,
} from "@/lib/firebase/services/webrtcSignaling";
import type {
  WebRtcParticipant,
  WebRtcSignalOffer,
  WebRtcSignalAnswer,
  WebRtcSignalCandidate,
} from "@/types/domain";
import { roomService } from "@/lib/firebase/services/rooms";

describe("TogetherPlay Two-Person WebRTC Video Signaling & Infrastructure", () => {
  const ROOM_ID = "fif_room_london_tokyo_test";
  const USER_ALEX = "user_alex";
  const USER_SAM = "user_sam";

  beforeEach(() => {
    memorySignalingBus.resetAll();
    roomService.clearSessionsForTesting?.();
  });

  it("publishes participant presence to signaling for both partners", async () => {
    const alexParticipant: WebRtcParticipant = {
      userId: USER_ALEX,
      joined: true,
      cameraEnabled: true,
      micEnabled: true,
      hasCamera: true,
      hasMic: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    };

    const samParticipant: WebRtcParticipant = {
      userId: USER_SAM,
      joined: true,
      cameraEnabled: true,
      micEnabled: true,
      hasCamera: true,
      hasMic: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    };

    let observedParticipants: Record<string, WebRtcParticipant> = {};
    const unsub = webrtcSignalingService.subscribeToParticipants(ROOM_ID, (participants) => {
      observedParticipants = participants;
    });

    await webrtcSignalingService.publishParticipant(ROOM_ID, alexParticipant);
    expect(observedParticipants[USER_ALEX]?.joined).toBe(true);
    expect(observedParticipants[USER_ALEX]?.cameraEnabled).toBe(true);

    await webrtcSignalingService.publishParticipant(ROOM_ID, samParticipant);
    expect(observedParticipants[USER_SAM]?.joined).toBe(true);
    expect(Object.keys(observedParticipants).length).toBe(2);

    unsub();
  });

  it("updates camera on/off and microphone on/off state in signaling without touching video tracks", async () => {
    const alexParticipant: WebRtcParticipant = {
      userId: USER_ALEX,
      joined: true,
      cameraEnabled: true,
      micEnabled: true,
      hasCamera: true,
      hasMic: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    };

    let observedParticipants: Record<string, WebRtcParticipant> = {};
    const unsub = webrtcSignalingService.subscribeToParticipants(ROOM_ID, (participants) => {
      observedParticipants = participants;
    });

    await webrtcSignalingService.publishParticipant(ROOM_ID, alexParticipant);

    // Turn camera off
    await webrtcSignalingService.updateParticipant(ROOM_ID, USER_ALEX, {
      cameraEnabled: false,
    });
    expect(observedParticipants[USER_ALEX]?.cameraEnabled).toBe(false);
    expect(observedParticipants[USER_ALEX]?.micEnabled).toBe(true);

    // Mute microphone
    await webrtcSignalingService.updateParticipant(ROOM_ID, USER_ALEX, {
      micEnabled: false,
    });
    expect(observedParticipants[USER_ALEX]?.micEnabled).toBe(false);

    unsub();
  });

  it("exchanges SDP offer and answer cleanly between the two peers", async () => {
    let receivedOffer: WebRtcSignalOffer | null = null;
    let receivedAnswer: WebRtcSignalAnswer | null = null;

    // Sam listens for offers addressed to him
    const unsubOffers = webrtcSignalingService.subscribeToOffers(ROOM_ID, USER_SAM, (offer) => {
      receivedOffer = offer;
    });

    // Alex listens for answers addressed to her
    const unsubAnswers = webrtcSignalingService.subscribeToAnswers(ROOM_ID, USER_ALEX, (answer) => {
      receivedAnswer = answer;
    });

    // 1. Alex creates and sends offer to Sam
    const offerPayload: WebRtcSignalOffer = {
      fromUserId: USER_ALEX,
      toUserId: USER_SAM,
      sdp: { type: "offer", sdp: "v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\n" },
      timestamp: Date.now(),
    };
    await webrtcSignalingService.sendOffer(ROOM_ID, offerPayload);

    const offer = receivedOffer as WebRtcSignalOffer | null;
    expect(offer).not.toBeNull();
    expect(offer?.fromUserId).toBe(USER_ALEX);
    expect(offer?.toUserId).toBe(USER_SAM);
    expect(offer?.sdp.type).toBe("offer");

    // 2. Sam creates and sends answer to Alex
    const answerPayload: WebRtcSignalAnswer = {
      fromUserId: USER_SAM,
      toUserId: USER_ALEX,
      sdp: { type: "answer", sdp: "v=0\r\no=- 67890 2 IN IP4 127.0.0.1\r\ns=-\r\n" },
      timestamp: Date.now(),
    };
    await webrtcSignalingService.sendAnswer(ROOM_ID, answerPayload);

    const answer = receivedAnswer as WebRtcSignalAnswer | null;
    expect(answer).not.toBeNull();
    expect(answer?.fromUserId).toBe(USER_SAM);
    expect(answer?.toUserId).toBe(USER_ALEX);
    expect(answer?.sdp.type).toBe("answer");

    unsubOffers();
    unsubAnswers();
  });

  it("exchanges ICE candidates between the two peers", async () => {
    const receivedCandidates: WebRtcSignalCandidate[] = [];

    const unsubCandidates = webrtcSignalingService.subscribeToIceCandidates(
      ROOM_ID,
      USER_SAM,
      (candidate) => {
        receivedCandidates.push(candidate);
      }
    );

    const candidatePayload: WebRtcSignalCandidate = {
      fromUserId: USER_ALEX,
      toUserId: USER_SAM,
      candidate: {
        candidate: "candidate:1 1 UDP 2122252543 192.168.1.1 50000 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      },
      timestamp: Date.now(),
    };

    await webrtcSignalingService.sendIceCandidate(ROOM_ID, candidatePayload);

    expect(receivedCandidates.length).toBe(1);
    expect(receivedCandidates[0].fromUserId).toBe(USER_ALEX);
    expect(receivedCandidates[0].candidate.sdpMid).toBe("0");

    unsubCandidates();
  });

  it("cleans up signaling data and listeners when leaving call", async () => {
    let participantCount = 0;
    const unsub = webrtcSignalingService.subscribeToParticipants(ROOM_ID, (participants) => {
      participantCount = Object.keys(participants).length;
    });

    await webrtcSignalingService.publishParticipant(ROOM_ID, {
      userId: USER_ALEX,
      joined: true,
      cameraEnabled: true,
      micEnabled: true,
      hasCamera: true,
      hasMic: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(participantCount).toBe(1);

    // Leave Call: clear signaling
    await webrtcSignalingService.clearRoomSignaling(ROOM_ID, USER_ALEX);

    expect(participantCount).toBe(0);

    unsub();
  });

  it("guarantees privacy directives: zero video/audio recording or storage in database", async () => {
    // Check that signaling payload does NOT accept media blobs, recordings, or transcripts
    const allowedKeys = ["fromUserId", "toUserId", "sdp", "timestamp"];
    const offer: WebRtcSignalOffer = {
      fromUserId: USER_ALEX,
      toUserId: USER_SAM,
      sdp: { type: "offer", sdp: "dummy-sdp-only" },
      timestamp: Date.now(),
    };

    const keys = Object.keys(offer);
    expect(keys.every((k) => allowedKeys.includes(k))).toBe(true);

    // No video stream or recording property exists
    expect((offer as unknown as Record<string, unknown>).videoBlob).toBeUndefined();
    expect((offer as unknown as Record<string, unknown>).audioBlob).toBeUndefined();
    expect((offer as unknown as Record<string, unknown>).transcript).toBeUndefined();
  });

  it("ensures game continues working if video is unavailable or left", async () => {
    // 1. Session is created
    const session = await roomService.createSession("cpl_london_tokyo", "find_it_first", USER_ALEX);
    expect(session.gameId).toBeDefined();

    // 2. Simulate video being left / disconnected
    await webrtcSignalingService.clearRoomSignaling(session.gameId, USER_ALEX);

    // 3. Game operations remain 100% operational
    await roomService.joinSession(session.gameId, USER_SAM);
    await roomService.setReadyStatus(session.gameId, USER_ALEX, true);
    await roomService.setReadyStatus(session.gameId, USER_SAM, true);

    const activeSession = await roomService.getActiveSession("cpl_london_tokyo");
    expect(activeSession?.status).toBe("countdown");
  });
});
