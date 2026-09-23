import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  webrtcSignalingService,
  memorySignalingBus,
  SignalingSecurityError,
  MAX_SDP_PAYLOAD_CHARS,
  MAX_ICE_CANDIDATE_CHARS,
} from "@/lib/firebase/services/webrtcSignaling";
import type {
  WebRtcSignalOffer,
  WebRtcSignalAnswer,
  WebRtcSignalCandidate,
  WebRtcParticipant,
} from "@/types/domain";

describe("WebRTC Signaling Abuse Controls Security Hardening", () => {
  const ROOM_ID = "fif_game_tokyo_london_99";
  const USER_A = "user_participant_a";
  const USER_B = "user_participant_b";
  const USER_ATTACKER = "user_third_party_attacker";

  beforeEach(() => {
    memorySignalingBus.resetAll();
    // Authorize legitimate participants A and B
    memorySignalingBus.authorizeRoomUsers(ROOM_ID, [USER_A, USER_B]);
    memorySignalingBus.setStrictAuthorization(true);
  });

  // 1. Valid participant A -> B signaling
  it("1. allows valid participant A -> B signaling (presence, offer, candidates)", async () => {
    // Participant A presence
    await webrtcSignalingService.publishParticipant(ROOM_ID, {
      userId: USER_A,
      joined: true,
      cameraEnabled: true,
      micEnabled: true,
      hasCamera: true,
      hasMic: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    });

    let receivedOffer: WebRtcSignalOffer | null = null;
    const unsub = webrtcSignalingService.subscribeToOffers(ROOM_ID, USER_B, (offer) => {
      receivedOffer = offer;
    });

    // Valid SDP offer A -> B
    const validOffer: WebRtcSignalOffer = {
      fromUserId: USER_A,
      toUserId: USER_B,
      sdp: { type: "offer", sdp: "v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\n" },
      timestamp: Date.now(),
    };
    await webrtcSignalingService.sendOffer(ROOM_ID, validOffer);
    expect(receivedOffer).toEqual(validOffer);

    // Valid ICE candidate A -> B
    let receivedCandidate: WebRtcSignalCandidate | null = null;
    const unsubCand = webrtcSignalingService.subscribeToIceCandidates(ROOM_ID, USER_B, (cand) => {
      receivedCandidate = cand;
    });

    const validCandidate: WebRtcSignalCandidate = {
      fromUserId: USER_A,
      toUserId: USER_B,
      candidate: { candidate: "candidate:1 1 UDP 2122252543 192.168.1.1 50000 typ host" },
      timestamp: Date.now(),
    };
    await webrtcSignalingService.sendIceCandidate(ROOM_ID, validCandidate);
    expect(receivedCandidate).toEqual(validCandidate);

    unsub();
    unsubCand();
  });

  // 2. Valid participant B -> A signaling
  it("2. allows valid participant B -> A signaling (presence, answer, candidates)", async () => {
    // Participant B presence
    await webrtcSignalingService.publishParticipant(ROOM_ID, {
      userId: USER_B,
      joined: true,
      cameraEnabled: true,
      micEnabled: true,
      hasCamera: true,
      hasMic: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    });

    let receivedAnswer: WebRtcSignalAnswer | null = null;
    const unsub = webrtcSignalingService.subscribeToAnswers(ROOM_ID, USER_A, (answer) => {
      receivedAnswer = answer;
    });

    // Valid SDP answer B -> A
    const validAnswer: WebRtcSignalAnswer = {
      fromUserId: USER_B,
      toUserId: USER_A,
      sdp: { type: "answer", sdp: "v=0\r\no=- 67890 2 IN IP4 127.0.0.1\r\ns=-\r\n" },
      timestamp: Date.now(),
    };
    await webrtcSignalingService.sendAnswer(ROOM_ID, validAnswer);
    expect(receivedAnswer).toEqual(validAnswer);

    // Valid ICE candidate B -> A
    let receivedCandidate: WebRtcSignalCandidate | null = null;
    const unsubCand = webrtcSignalingService.subscribeToIceCandidates(ROOM_ID, USER_A, (cand) => {
      receivedCandidate = cand;
    });

    const validCandidate: WebRtcSignalCandidate = {
      fromUserId: USER_B,
      toUserId: USER_A,
      candidate: { candidate: "candidate:2 1 UDP 2122252543 192.168.1.2 50000 typ host" },
      timestamp: Date.now(),
    };
    await webrtcSignalingService.sendIceCandidate(ROOM_ID, validCandidate);
    expect(receivedCandidate).toEqual(validCandidate);

    unsub();
    unsubCand();
  });

  // 3. Third-party read denied
  it("3. denies third-party read on room signaling subscriptions", () => {
    // Attacker cannot subscribe to participants
    expect(() => {
      webrtcSignalingService.subscribeToParticipants(ROOM_ID, () => {}, USER_ATTACKER);
    }).toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));

    // Attacker cannot subscribe to offers
    expect(() => {
      webrtcSignalingService.subscribeToOffers(ROOM_ID, USER_ATTACKER, () => {});
    }).toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));

    // Attacker cannot subscribe to answers
    expect(() => {
      webrtcSignalingService.subscribeToAnswers(ROOM_ID, USER_ATTACKER, () => {});
    }).toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));

    // Attacker cannot subscribe to ICE candidates
    expect(() => {
      webrtcSignalingService.subscribeToIceCandidates(ROOM_ID, USER_ATTACKER, () => {});
    }).toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
  });

  // 4. Third-party write denied
  it("4. denies third-party write on room signaling operations", async () => {
    // Attacker cannot publish presence
    await expect(
      webrtcSignalingService.publishParticipant(ROOM_ID, {
        userId: USER_ATTACKER,
        joined: true,
        cameraEnabled: true,
        micEnabled: true,
        hasCamera: true,
        hasMic: true,
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));

    // Attacker cannot send offer
    await expect(
      webrtcSignalingService.sendOffer(ROOM_ID, {
        fromUserId: USER_ATTACKER,
        toUserId: USER_B,
        sdp: { type: "offer", sdp: "v=0..." },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));

    // Attacker cannot send answer
    await expect(
      webrtcSignalingService.sendAnswer(ROOM_ID, {
        fromUserId: USER_ATTACKER,
        toUserId: USER_A,
        sdp: { type: "answer", sdp: "v=0..." },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));

    // Attacker cannot send ICE candidate
    await expect(
      webrtcSignalingService.sendIceCandidate(ROOM_ID, {
        fromUserId: USER_ATTACKER,
        toUserId: USER_A,
        candidate: { candidate: "candidate:1..." },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
  });

  // 5. Oversized SDP denied
  it("5. denies oversized SDP offer and answer (> 32 KB)", async () => {
    const oversizedSdp = "v=0\r\n" + "a=candidate:".padEnd(MAX_SDP_PAYLOAD_CHARS + 500, "X");

    await expect(
      webrtcSignalingService.sendOffer(ROOM_ID, {
        fromUserId: USER_A,
        toUserId: USER_B,
        sdp: { type: "offer", sdp: oversizedSdp },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "PAYLOAD_TOO_LARGE" }));

    await expect(
      webrtcSignalingService.sendAnswer(ROOM_ID, {
        fromUserId: USER_B,
        toUserId: USER_A,
        sdp: { type: "answer", sdp: oversizedSdp },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "PAYLOAD_TOO_LARGE" }));
  });

  // 6. Oversized ICE candidate denied
  it("6. denies oversized ICE candidate (> 2 KB)", async () => {
    const oversizedCandidateStr = "candidate:".padEnd(MAX_ICE_CANDIDATE_CHARS + 200, "Y");

    await expect(
      webrtcSignalingService.sendIceCandidate(ROOM_ID, {
        fromUserId: USER_A,
        toUserId: USER_B,
        candidate: { candidate: oversizedCandidateStr },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "PAYLOAD_TOO_LARGE" }));
  });

  // 7. Excessive candidate creation denied where enforceable
  it("7. denies excessive candidate creation exceeding rate and session bounds", async () => {
    // 1. Rate limit: 60 writes per minute
    for (let i = 0; i < 60; i++) {
      await webrtcSignalingService.sendIceCandidate(ROOM_ID, {
        fromUserId: USER_A,
        toUserId: USER_B,
        candidate: { candidate: `candidate:${i}` },
        timestamp: Date.now(),
      });
    }

    // 61st write within same minute is rejected
    await expect(
      webrtcSignalingService.sendIceCandidate(ROOM_ID, {
        fromUserId: USER_A,
        toUserId: USER_B,
        candidate: { candidate: "candidate:exceeded" },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "RATE_LIMITED" }));

    // 2. Session limit: 100 candidates per session
    // Reset minute limits to test session accumulation
    for (let i = 60; i < 100; i++) {
      memorySignalingBus.resetMinuteLimits();
      await webrtcSignalingService.sendIceCandidate(ROOM_ID, {
        fromUserId: USER_A,
        toUserId: USER_B,
        candidate: { candidate: `candidate:${i}` },
        timestamp: Date.now(),
      });
    }

    // 101st candidate for session is rejected
    memorySignalingBus.resetMinuteLimits();
    await expect(
      webrtcSignalingService.sendIceCandidate(ROOM_ID, {
        fromUserId: USER_A,
        toUserId: USER_B,
        candidate: { candidate: "candidate:session_overflow" },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "RATE_LIMITED" }));
  });

  // 8. Invalid room / participant relationship denied
  it("8. denies invalid room/participant relationships (sending to self, outsider, or blank)", async () => {
    // Sending to oneself
    await expect(
      webrtcSignalingService.sendOffer(ROOM_ID, {
        fromUserId: USER_A,
        toUserId: USER_A,
        sdp: { type: "offer", sdp: "v=0..." },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "WRONG_PARTICIPANT" }));

    // Sending to unauthorized outsider
    await expect(
      webrtcSignalingService.sendOffer(ROOM_ID, {
        fromUserId: USER_A,
        toUserId: USER_ATTACKER,
        sdp: { type: "offer", sdp: "v=0..." },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "WRONG_PARTICIPANT" }));

    // Sending with blank recipient
    await expect(
      webrtcSignalingService.sendIceCandidate(ROOM_ID, {
        fromUserId: USER_A,
        toUserId: "   ",
        candidate: { candidate: "candidate:0..." },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "WRONG_PARTICIPANT" }));

    // Sending with empty room ID
    await expect(
      webrtcSignalingService.sendOffer("", {
        fromUserId: USER_A,
        toUserId: USER_B,
        sdp: { type: "offer", sdp: "v=0..." },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "INVALID_ROOM" }));

    // Adding third participant
    const USER_THIRD = "user_third_participant";
    memorySignalingBus.authorizeRoomUsers(ROOM_ID, [USER_THIRD]);
    await webrtcSignalingService.publishParticipant(ROOM_ID, {
      userId: USER_A,
      joined: true,
      cameraEnabled: true,
      micEnabled: true,
      hasCamera: true,
      hasMic: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await webrtcSignalingService.publishParticipant(ROOM_ID, {
      userId: USER_B,
      joined: true,
      cameraEnabled: true,
      micEnabled: true,
      hasCamera: true,
      hasMic: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    });
    // Third participant is rejected because max participants is 2
    await expect(
      webrtcSignalingService.publishParticipant(ROOM_ID, {
        userId: USER_THIRD,
        joined: true,
        cameraEnabled: true,
        micEnabled: true,
        hasCamera: true,
        hasMic: true,
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
  });

  // 9. Stale/expired signaling rejected or cleaned according to lifecycle
  it("9. rejects stale signaling and cleans up transient data upon connection establishment", async () => {
    // A. Payload with expired timestamp (> 15 minutes old) is rejected
    const expiredTimestamp = Date.now() - 20 * 60 * 1000;
    await expect(
      webrtcSignalingService.sendOffer(ROOM_ID, {
        fromUserId: USER_A,
        toUserId: USER_B,
        sdp: { type: "offer", sdp: "v=0..." },
        timestamp: expiredTimestamp,
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "STALE_ROOM" }));

    // B. Stale room session is rejected
    memorySignalingBus.markRoomStale(ROOM_ID);
    await expect(
      webrtcSignalingService.sendOffer(ROOM_ID, {
        fromUserId: USER_A,
        toUserId: USER_B,
        sdp: { type: "offer", sdp: "v=0..." },
        timestamp: Date.now(),
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "STALE_ROOM" }));

    // C. Explicit cleanup after connection establishment (cleanupTransientSignaling)
    memorySignalingBus.markRoomStale(ROOM_ID, false);
    await webrtcSignalingService.publishParticipant(ROOM_ID, {
      userId: USER_A,
      joined: true,
      cameraEnabled: true,
      micEnabled: true,
      hasCamera: true,
      hasMic: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await webrtcSignalingService.sendOffer(ROOM_ID, {
      fromUserId: USER_A,
      toUserId: USER_B,
      sdp: { type: "offer", sdp: "v=0..." },
      timestamp: Date.now(),
    });
    expect(memorySignalingBus.getOffer(ROOM_ID, USER_B)).not.toBeNull();

    // Call cleanupTransientSignaling once connected
    await webrtcSignalingService.cleanupTransientSignaling(ROOM_ID, USER_B);

    // Offers/answers/candidates are purged to prevent unbounded accumulation
    expect(memorySignalingBus.getOffer(ROOM_ID, USER_B)).toBeNull();
    // Participant presence is preserved
    expect(memorySignalingBus.getParticipants(ROOM_ID)[USER_A]).toBeDefined();
  });

  // 10. Existing WebRTC happy path still works
  it("10. verifies complete existing WebRTC connection establishment happy path works end-to-end", async () => {
    // 1. Both participants publish presence
    await webrtcSignalingService.publishParticipant(ROOM_ID, {
      userId: USER_A,
      joined: true,
      cameraEnabled: true,
      micEnabled: true,
      hasCamera: true,
      hasMic: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await webrtcSignalingService.publishParticipant(ROOM_ID, {
      userId: USER_B,
      joined: true,
      cameraEnabled: true,
      micEnabled: true,
      hasCamera: true,
      hasMic: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    });

    let observedParticipants: Record<string, WebRtcParticipant> = {};
    const unsubPresence = webrtcSignalingService.subscribeToParticipants(ROOM_ID, (p) => {
      observedParticipants = p;
    });

    expect(Object.keys(observedParticipants).length).toBe(2);
    expect(observedParticipants[USER_A]?.joined).toBe(true);
    expect(observedParticipants[USER_B]?.joined).toBe(true);

    // 2. Offer from A to B
    let receivedOffer: WebRtcSignalOffer | null = null;
    const unsubOffer = webrtcSignalingService.subscribeToOffers(ROOM_ID, USER_B, (offer) => {
      receivedOffer = offer;
    });

    const offer: WebRtcSignalOffer = {
      fromUserId: USER_A,
      toUserId: USER_B,
      sdp: { type: "offer", sdp: "v=0\r\no=- 1111 2 IN IP4 127.0.0.1\r\ns=-\r\n" },
      timestamp: Date.now(),
    };
    await webrtcSignalingService.sendOffer(ROOM_ID, offer);
    expect(receivedOffer).toEqual(offer);

    // 3. Answer from B to A
    let receivedAnswer: WebRtcSignalAnswer | null = null;
    const unsubAnswer = webrtcSignalingService.subscribeToAnswers(ROOM_ID, USER_A, (answer) => {
      receivedAnswer = answer;
    });

    const answer: WebRtcSignalAnswer = {
      fromUserId: USER_B,
      toUserId: USER_A,
      sdp: { type: "answer", sdp: "v=0\r\no=- 2222 2 IN IP4 127.0.0.1\r\ns=-\r\n" },
      timestamp: Date.now(),
    };
    await webrtcSignalingService.sendAnswer(ROOM_ID, answer);
    expect(receivedAnswer).toEqual(answer);

    // 4. ICE candidate exchange
    const candidatesAtoB: WebRtcSignalCandidate[] = [];
    const candidatesBtoA: WebRtcSignalCandidate[] = [];

    const unsubCandB = webrtcSignalingService.subscribeToIceCandidates(ROOM_ID, USER_B, (c) => {
      candidatesAtoB.push(c);
    });
    const unsubCandA = webrtcSignalingService.subscribeToIceCandidates(ROOM_ID, USER_A, (c) => {
      candidatesBtoA.push(c);
    });

    await webrtcSignalingService.sendIceCandidate(ROOM_ID, {
      fromUserId: USER_A,
      toUserId: USER_B,
      candidate: { candidate: "candidate:candA 1 UDP 2122252543 192.168.1.1 50000 typ host" },
      timestamp: Date.now(),
    });
    await webrtcSignalingService.sendIceCandidate(ROOM_ID, {
      fromUserId: USER_B,
      toUserId: USER_A,
      candidate: { candidate: "candidate:candB 1 UDP 2122252543 192.168.1.2 50000 typ host" },
      timestamp: Date.now(),
    });

    expect(candidatesAtoB).toHaveLength(1);
    expect(candidatesBtoA).toHaveLength(1);

    // 5. Connection established -> clean transient signaling
    await webrtcSignalingService.cleanupTransientSignaling(ROOM_ID, USER_A);
    await webrtcSignalingService.cleanupTransientSignaling(ROOM_ID, USER_B);

    // 6. Tear down when call ends
    await webrtcSignalingService.clearRoomSignaling(ROOM_ID, USER_A);
    await webrtcSignalingService.clearRoomSignaling(ROOM_ID, USER_B);

    expect(observedParticipants[USER_A]).toBeUndefined();
    expect(observedParticipants[USER_B]).toBeUndefined();

    unsubPresence();
    unsubOffer();
    unsubAnswer();
    unsubCandB();
    unsubCandA();
  });

  // Database Rules Schema & Authorization Invariant Validation
  describe("Database Rules Schema Inspection", () => {
    const rulesPath = path.join(process.cwd(), "database.rules.json");
    const rulesContent = fs.readFileSync(rulesPath, "utf-8");
    const rules = JSON.parse(rulesContent);

    it("verifies webrtc_signaling RTDB rules enforce participant-scoped authorization", () => {
      const signalingRules = rules.rules.webrtc_signaling;
      expect(signalingRules).toBeDefined();

      const roomRules = signalingRules["$roomId"];
      expect(roomRules).toBeDefined();

      // Read rule requires authorization via authorizedUsers, gameStates, or couples
      expect(roomRules[".read"]).toContain("data.child('authorizedUsers').hasChild(auth.uid)");
      expect(roomRules[".read"]).toContain("root.child('gameStates').child($roomId)");
      expect(roomRules[".read"]).toContain("root.child('couples').child($roomId)");

      // Offers and answers bounded payload sizes
      expect(roomRules.offers["$toUserId"][".validate"]).toContain("32768");
      expect(roomRules.answers["$toUserId"][".validate"]).toContain("32768");

      // Candidates bounded payload size
      expect(roomRules.candidates["$toUserId"]["$candidateId"][".validate"]).toContain("2048");

      // Timestamp lifecycle bounds enforced
      expect(roomRules.offers["$toUserId"][".validate"]).toContain("now - 900000");
      expect(roomRules.answers["$toUserId"][".validate"]).toContain("now - 900000");
      expect(roomRules.candidates["$toUserId"]["$candidateId"][".validate"]).toContain("now - 900000");
    });
  });
});
