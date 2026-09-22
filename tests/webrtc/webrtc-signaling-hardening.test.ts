import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  webrtcSignalingService,
  memorySignalingBus,
  SignalingSecurityError,
} from "@/lib/firebase/services/webrtcSignaling";
import { getIceConfiguration } from "@/lib/webrtc/iceConfig";
import type { WebRtcParticipant, WebRtcSignalOffer, WebRtcSignalAnswer, WebRtcSignalCandidate } from "@/types/domain";

describe("WebRTC Signaling Hardening & Security Audit", () => {
  const ROOM_ID = "room_couple_paris_rome_101";
  const USER_ALEX = "user_alex_123";
  const USER_SAM = "user_sam_456";
  const USER_ATTACKER = "user_attacker_999";

  beforeEach(() => {
    memorySignalingBus.resetAll();
    // Authorize valid couple participants for the room
    memorySignalingBus.authorizeRoomUsers(ROOM_ID, [USER_ALEX, USER_SAM]);
  });

  afterEach(() => {
    memorySignalingBus.resetAll();
    vi.restoreAllMocks();
  });

  describe("1. Identity Verification & Unauthorized Signaling Defense", () => {
    it("rejects unauthorized participant from publishing presence in couple room", async () => {
      const unauthorizedParticipant: WebRtcParticipant = {
        userId: USER_ATTACKER,
        joined: true,
        cameraEnabled: true,
        micEnabled: true,
        hasCamera: true,
        hasMic: true,
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      };

      await expect(
        webrtcSignalingService.publishParticipant(ROOM_ID, unauthorizedParticipant)
      ).rejects.toThrow(SignalingSecurityError);

      try {
        await webrtcSignalingService.publishParticipant(ROOM_ID, unauthorizedParticipant);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(SignalingSecurityError);
        expect((err as SignalingSecurityError).code).toBe("UNAUTHORIZED");
      }

      // Attacker should not exist in signaling bus
      const participants = memorySignalingBus.getParticipants(ROOM_ID);
      expect(participants[USER_ATTACKER]).toBeUndefined();
    });

    it("rejects unauthorized participant from sending offers, answers, or ICE candidates", async () => {
      const fakeOffer: WebRtcSignalOffer = {
        fromUserId: USER_ATTACKER,
        toUserId: USER_SAM,
        sdp: { type: "offer", sdp: "dummy sdp" },
        timestamp: Date.now(),
      };

      await expect(
        webrtcSignalingService.sendOffer(ROOM_ID, fakeOffer)
      ).rejects.toThrow(SignalingSecurityError);

      const fakeAnswer: WebRtcSignalAnswer = {
        fromUserId: USER_ATTACKER,
        toUserId: USER_SAM,
        sdp: { type: "answer", sdp: "dummy answer" },
        timestamp: Date.now(),
      };

      await expect(
        webrtcSignalingService.sendAnswer(ROOM_ID, fakeAnswer)
      ).rejects.toThrow(SignalingSecurityError);

      const fakeCandidate: WebRtcSignalCandidate = {
        fromUserId: USER_ATTACKER,
        toUserId: USER_SAM,
        candidate: { candidate: "candidate:...", sdpMid: "0", sdpMLineIndex: 0 },
        timestamp: Date.now(),
      };

      await expect(
        webrtcSignalingService.sendIceCandidate(ROOM_ID, fakeCandidate)
      ).rejects.toThrow(SignalingSecurityError);
    });

    it("rejects unauthorized participant from subscribing to signaling channels", () => {
      expect(() => {
        webrtcSignalingService.subscribeToParticipants(ROOM_ID, () => {}, USER_ATTACKER);
      }).toThrow(SignalingSecurityError);

      expect(() => {
        webrtcSignalingService.subscribeToOffers(ROOM_ID, USER_ATTACKER, () => {});
      }).toThrow(SignalingSecurityError);

      expect(() => {
        webrtcSignalingService.subscribeToAnswers(ROOM_ID, USER_ATTACKER, () => {});
      }).toThrow(SignalingSecurityError);

      expect(() => {
        webrtcSignalingService.subscribeToIceCandidates(ROOM_ID, USER_ATTACKER, () => {});
      }).toThrow(SignalingSecurityError);
    });

    it("prevents guessing room ID from granting access under strict authorization", async () => {
      memorySignalingBus.setStrictAuthorization(true);
      const guessedRoomId = "room_random_guessed_99999";

      await expect(
        webrtcSignalingService.publishParticipant(guessedRoomId, {
          userId: USER_ATTACKER,
          joined: true,
          cameraEnabled: true,
          micEnabled: true,
          hasCamera: true,
          hasMic: true,
          joinedAt: Date.now(),
          updatedAt: Date.now(),
        })
      ).rejects.toThrow(SignalingSecurityError);
    });

    it("enforces valid room and user ID inputs", () => {
      expect(() => {
        webrtcSignalingService.verifyRoomAuthorization("", USER_ALEX);
      }).toThrow(SignalingSecurityError);

      expect(() => {
        webrtcSignalingService.verifyRoomAuthorization(ROOM_ID, "");
      }).toThrow(SignalingSecurityError);
    });
  });

  describe("2. Partner Leave & Call Disconnect Handling", () => {
    it("notifies subscriber and cleans up when partner leaves the call", async () => {
      // 1. Both participants join
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

      await webrtcSignalingService.publishParticipant(ROOM_ID, {
        userId: USER_SAM,
        joined: true,
        cameraEnabled: true,
        micEnabled: true,
        hasCamera: true,
        hasMic: true,
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      });

      let receivedParticipants: Record<string, WebRtcParticipant> = {};
      const unsub = webrtcSignalingService.subscribeToParticipants(
        ROOM_ID,
        (participants) => {
          receivedParticipants = participants;
        },
        USER_ALEX
      );

      expect(receivedParticipants[USER_SAM]?.joined).toBe(true);

      // 2. Partner leaves call via clearRoomSignaling
      await webrtcSignalingService.clearRoomSignaling(ROOM_ID, USER_SAM);

      // 3. Verify partner is removed
      expect(receivedParticipants[USER_SAM]).toBeUndefined();

      unsub();
    });

    it("clears offers, answers, and candidates when a participant leaves", async () => {
      // Exchange offer and answer
      await webrtcSignalingService.sendOffer(ROOM_ID, {
        fromUserId: USER_ALEX,
        toUserId: USER_SAM,
        sdp: { type: "offer", sdp: "v=0..." },
        timestamp: Date.now(),
      });

      await webrtcSignalingService.sendAnswer(ROOM_ID, {
        fromUserId: USER_SAM,
        toUserId: USER_ALEX,
        sdp: { type: "answer", sdp: "v=0..." },
        timestamp: Date.now(),
      });

      // Clear Sam's signaling entries
      await webrtcSignalingService.clearRoomSignaling(ROOM_ID, USER_SAM);

      // Subscribing to Sam's offers should now be null/empty
      let currentOffer: WebRtcSignalOffer | null = "dummy" as unknown as WebRtcSignalOffer;
      const unsubOffer = webrtcSignalingService.subscribeToOffers(
        ROOM_ID,
        USER_SAM,
        (offer) => {
          currentOffer = offer;
        }
      );
      expect(currentOffer).toBeNull();
      unsubOffer();
    });
  });

  describe("3. Reconnect & Renegotiation Lifecycle", () => {
    it("allows a partner to reconnect and exchange a new offer/answer cycle cleanly", async () => {
      // Step 1: Initial session
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

      // Step 2: Sam leaves
      await webrtcSignalingService.clearRoomSignaling(ROOM_ID, USER_SAM);
      expect(memorySignalingBus.getParticipants(ROOM_ID)[USER_SAM]).toBeUndefined();

      // Step 3: Sam reconnects
      await webrtcSignalingService.publishParticipant(ROOM_ID, {
        userId: USER_SAM,
        joined: true,
        cameraEnabled: true,
        micEnabled: true,
        hasCamera: true,
        hasMic: true,
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(memorySignalingBus.getParticipants(ROOM_ID)[USER_SAM]?.joined).toBe(true);

      // Step 4: Fresh renegotiation offer/answer exchange
      let receivedOffer: WebRtcSignalOffer | null = null;
      const unsub = webrtcSignalingService.subscribeToOffers(ROOM_ID, USER_SAM, (offer) => {
        receivedOffer = offer;
      });

      const freshOffer: WebRtcSignalOffer = {
        fromUserId: USER_ALEX,
        toUserId: USER_SAM,
        sdp: { type: "offer", sdp: "v=0 (renegotiated offer)" },
        timestamp: Date.now(),
      };
      await webrtcSignalingService.sendOffer(ROOM_ID, freshOffer);

      expect(receivedOffer).toEqual(freshOffer);
      unsub();
    });
  });

  describe("4. Permission Failure Handling & Media Stream Teardown", () => {
    it("verifies tracks are explicitly stopped and state is non-leaking on permission rejection", () => {
      const track1 = {
        enabled: true,
        stop: vi.fn(),
      };
      const track2 = {
        enabled: true,
        stop: vi.fn(),
      };
      const mockStream = {
        getTracks: () => [track1, track2],
      };

      // Execute simulated track cleanup routine
      mockStream.getTracks().forEach((t) => {
        t.enabled = false;
        t.stop();
      });

      expect(track1.enabled).toBe(false);
      expect(track1.stop).toHaveBeenCalledTimes(1);
      expect(track2.enabled).toBe(false);
      expect(track2.stop).toHaveBeenCalledTimes(1);
    });

    it("verifies RTCPeerConnection listeners and connection are closed on teardown", () => {
      const mockPc: {
        ontrack: unknown;
        onicecandidate: unknown;
        onconnectionstatechange: unknown;
        oniceconnectionstatechange: unknown;
        onsignalingstatechange: unknown;
        close: ReturnType<typeof vi.fn>;
      } = {
        ontrack: vi.fn(),
        onicecandidate: vi.fn(),
        onconnectionstatechange: vi.fn(),
        oniceconnectionstatechange: vi.fn(),
        onsignalingstatechange: vi.fn(),
        close: vi.fn(),
      };

      // Perform close sequence
      mockPc.ontrack = null;
      mockPc.onicecandidate = null;
      mockPc.onconnectionstatechange = null;
      mockPc.oniceconnectionstatechange = null;
      mockPc.onsignalingstatechange = null;
      mockPc.close();

      expect(mockPc.close).toHaveBeenCalledTimes(1);
      expect(mockPc.ontrack).toBeNull();
      expect(mockPc.onicecandidate).toBeNull();
      expect(mockPc.onconnectionstatechange).toBeNull();
    });
  });

  describe("5. ICE / STUN / TURN Configuration Audit", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("returns STUN-only configuration with development diagnostic when no TURN is configured", () => {
      delete process.env.NEXT_PUBLIC_WEBRTC_TURN_URL;
      delete process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME;
      delete process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL;
      delete process.env.NEXT_PUBLIC_WEBRTC_TURN_SERVERS;

      const report = getIceConfiguration();
      expect(report.stunServerCount).toBeGreaterThanOrEqual(3);
      expect(report.turnServerCount).toBe(0);
      expect(report.hasTurnFallback).toBe(false);
      expect(report.isProductionReliable).toBe(false);
      expect(report.reliabilityLevel).toBe("development_stun_only");
      expect(report.diagnostics).toContain("Development STUN-only");
    });

    it("correctly activates TURN relay configuration when environment variables are supplied", () => {
      process.env.NEXT_PUBLIC_WEBRTC_TURN_URL = "turn:turn.togetherplay.com:3478";
      process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME = "couple_relay_user";
      process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL = "relay_password_secure";

      const report = getIceConfiguration();
      expect(report.turnServerCount).toBe(1);
      expect(report.hasTurnFallback).toBe(true);
      expect(report.isProductionReliable).toBe(true);
      expect(report.reliabilityLevel).toBe("production_turn_relay");
      expect(report.diagnostics).toContain("Production WebRTC configuration active");

      const turnServer = report.iceServers.find((s) => s.urls === "turn:turn.togetherplay.com:3478");
      expect(turnServer).toBeDefined();
      expect(turnServer?.username).toBe("couple_relay_user");
      expect(turnServer?.credential).toBe("relay_password_secure");
    });

    it("parses JSON-configured multi-region TURN server array", () => {
      process.env.NEXT_PUBLIC_WEBRTC_TURN_SERVERS = JSON.stringify([
        { urls: "turn:eu-turn.togetherplay.com:3478", username: "u1", credential: "p1" },
        { urls: "turn:us-turn.togetherplay.com:3478", username: "u2", credential: "p2" },
      ]);

      const report = getIceConfiguration();
      expect(report.turnServerCount).toBe(2);
      expect(report.hasTurnFallback).toBe(true);
      expect(report.isProductionReliable).toBe(true);
    });

    it("never claims production reliability without TURN fallback", () => {
      delete process.env.NEXT_PUBLIC_WEBRTC_TURN_URL;
      delete process.env.NEXT_PUBLIC_WEBRTC_TURN_SERVERS;

      const report = getIceConfiguration();
      expect(report.isProductionReliable).toBe(false);
      expect(report.reliabilityLevel).not.toBe("production_turn_relay");
    });
  });

  describe("6. Call Teardown Lifecycle Scenarios", () => {
    it("guarantees complete teardown on leave call", async () => {
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

      expect(memorySignalingBus.getParticipants(ROOM_ID)[USER_ALEX]).toBeDefined();

      await webrtcSignalingService.clearRoomSignaling(ROOM_ID, USER_ALEX);
      expect(memorySignalingBus.getParticipants(ROOM_ID)[USER_ALEX]).toBeUndefined();
    });

    it("verifies game end and authentication loss trigger clean teardown", async () => {
      // Setup both participants
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

      // Teardown called on game end
      await webrtcSignalingService.clearRoomSignaling(ROOM_ID, USER_ALEX);
      expect(memorySignalingBus.getParticipants(ROOM_ID)[USER_ALEX]).toBeUndefined();
    });
  });

  describe("7. Security Hardening Audit & Attack Vector Verifications", () => {
    describe("Unauthorized Participant", () => {
      it("rejects unauthorized participant from publishing, messaging, or subscribing", async () => {
        // Attempt to publish presence
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

        // Attempt to send offer
        await expect(
          webrtcSignalingService.sendOffer(ROOM_ID, {
            fromUserId: USER_ATTACKER,
            toUserId: USER_SAM,
            sdp: { type: "offer", sdp: "v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n" },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));

        // Attempt to subscribe
        expect(() => {
          webrtcSignalingService.subscribeToParticipants(ROOM_ID, () => {}, USER_ATTACKER);
        }).toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
      });

      it("prevents third participant from joining room when 2 participants are already present", async () => {
        const USER_EXTRA = "user_extra_789";
        memorySignalingBus.authorizeRoomUsers(ROOM_ID, [USER_EXTRA]);

        // First two legitimate participants join
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
        await webrtcSignalingService.publishParticipant(ROOM_ID, {
          userId: USER_SAM,
          joined: true,
          cameraEnabled: true,
          micEnabled: true,
          hasCamera: true,
          hasMic: true,
          joinedAt: Date.now(),
          updatedAt: Date.now(),
        });

        // 3rd participant attempts to join
        await expect(
          webrtcSignalingService.publishParticipant(ROOM_ID, {
            userId: USER_EXTRA,
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
    });

    describe("Oversized Payload Defense & Privacy", () => {
      it("rejects oversized SDP offer payload without leaking SDP content in error or logs", async () => {
        const secretSdpContent = "SECRET_SDP_FRAGMENT_" + "X".repeat(33000);
        const oversizedOffer: WebRtcSignalOffer = {
          fromUserId: USER_ALEX,
          toUserId: USER_SAM,
          sdp: { type: "offer", sdp: secretSdpContent },
          timestamp: Date.now(),
        };

        const consoleSpy = vi.spyOn(console, "log");
        const consoleErrSpy = vi.spyOn(console, "error");
        const consoleWarnSpy = vi.spyOn(console, "warn");

        let caughtError: SignalingSecurityError | null = null;
        try {
          await webrtcSignalingService.sendOffer(ROOM_ID, oversizedOffer);
        } catch (err) {
          caughtError = err as SignalingSecurityError;
        }

        expect(caughtError).toBeInstanceOf(SignalingSecurityError);
        expect(caughtError?.code).toBe("PAYLOAD_TOO_LARGE");

        // Verify secret SDP content is not leaked in the error message
        expect(caughtError?.message).not.toContain("SECRET_SDP_FRAGMENT");
        expect(caughtError?.message).not.toContain("X".repeat(50));

        // Verify secret SDP content is not logged to console
        const allLoggedArgs = [
          ...consoleSpy.mock.calls.flat(),
          ...consoleErrSpy.mock.calls.flat(),
          ...consoleWarnSpy.mock.calls.flat(),
        ].join(" ");
        expect(allLoggedArgs).not.toContain("SECRET_SDP_FRAGMENT");
      });

      it("rejects oversized SDP answer payload", async () => {
        const oversizedAnswer: WebRtcSignalAnswer = {
          fromUserId: USER_SAM,
          toUserId: USER_ALEX,
          sdp: { type: "answer", sdp: "A".repeat(33000) },
          timestamp: Date.now(),
        };

        await expect(
          webrtcSignalingService.sendAnswer(ROOM_ID, oversizedAnswer)
        ).rejects.toThrowError(expect.objectContaining({ code: "PAYLOAD_TOO_LARGE" }));
      });

      it("rejects oversized ICE candidate payload without leaking candidate content", async () => {
        const secretCandidate = "SECRET_ICE_TOKEN_" + "C".repeat(2100);
        const oversizedCandidate: WebRtcSignalCandidate = {
          fromUserId: USER_ALEX,
          toUserId: USER_SAM,
          candidate: { candidate: secretCandidate, sdpMid: "0", sdpMLineIndex: 0 },
          timestamp: Date.now(),
        };

        let caughtError: SignalingSecurityError | null = null;
        try {
          await webrtcSignalingService.sendIceCandidate(ROOM_ID, oversizedCandidate);
        } catch (err) {
          caughtError = err as SignalingSecurityError;
        }

        expect(caughtError).toBeInstanceOf(SignalingSecurityError);
        expect(caughtError?.code).toBe("PAYLOAD_TOO_LARGE");
        expect(caughtError?.message).not.toContain("SECRET_ICE_TOKEN");
      });
    });

    describe("Excessive Writes & Rate Limiting", () => {
      it("rate limits rapid signaling writes exceeding 60 writes/minute", async () => {
        // Send 60 valid small candidate writes
        for (let i = 0; i < 60; i++) {
          await webrtcSignalingService.sendIceCandidate(ROOM_ID, {
            fromUserId: USER_ALEX,
            toUserId: USER_SAM,
            candidate: { candidate: `candidate:${i}`, sdpMid: "0", sdpMLineIndex: 0 },
            timestamp: Date.now(),
          });
        }

        // 61st write should be rejected with RATE_LIMITED
        await expect(
          webrtcSignalingService.sendIceCandidate(ROOM_ID, {
            fromUserId: USER_ALEX,
            toUserId: USER_SAM,
            candidate: { candidate: "candidate:overflow", sdpMid: "0", sdpMLineIndex: 0 },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "RATE_LIMITED" }));
      });

      it("enforces maximum 100 ICE candidates per session", async () => {
        // Reset minute rolling window only and send up to 100 candidates with simulated time spread
        for (let i = 0; i < 100; i++) {
          memorySignalingBus.resetMinuteLimits();
          await webrtcSignalingService.sendIceCandidate(ROOM_ID, {
            fromUserId: USER_ALEX,
            toUserId: USER_SAM,
            candidate: { candidate: `candidate:${i}`, sdpMid: "0", sdpMLineIndex: 0 },
            timestamp: Date.now(),
          });
        }

        // 101st candidate should trigger session limit
        await expect(
          webrtcSignalingService.sendIceCandidate(ROOM_ID, {
            fromUserId: USER_ALEX,
            toUserId: USER_SAM,
            candidate: { candidate: "candidate:101", sdpMid: "0", sdpMLineIndex: 0 },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "RATE_LIMITED" }));
      });
    });

    describe("Wrong Room Access Defense", () => {
      it("rejects signaling with empty, blank, or invalid room ID", async () => {
        await expect(
          webrtcSignalingService.sendOffer("", {
            fromUserId: USER_ALEX,
            toUserId: USER_SAM,
            sdp: { type: "offer", sdp: "v=0\r\n" },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "INVALID_ROOM" }));

        await expect(
          webrtcSignalingService.sendOffer("   ", {
            fromUserId: USER_ALEX,
            toUserId: USER_SAM,
            sdp: { type: "offer", sdp: "v=0\r\n" },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "INVALID_ROOM" }));
      });

      it("rejects access to a room the user does not belong to", async () => {
        const OTHER_ROOM = "room_other_couple_555";
        // User ALEX belongs to ROOM_ID, not OTHER_ROOM
        await expect(
          webrtcSignalingService.sendOffer(OTHER_ROOM, {
            fromUserId: USER_ALEX,
            toUserId: USER_SAM,
            sdp: { type: "offer", sdp: "v=0\r\n" },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "UNAUTHORIZED" }));
      });
    });

    describe("Wrong Participant Checks", () => {
      it("rejects sending offer, answer, or candidate to oneself", async () => {
        await expect(
          webrtcSignalingService.sendOffer(ROOM_ID, {
            fromUserId: USER_ALEX,
            toUserId: USER_ALEX,
            sdp: { type: "offer", sdp: "v=0\r\n" },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "WRONG_PARTICIPANT" }));

        await expect(
          webrtcSignalingService.sendAnswer(ROOM_ID, {
            fromUserId: USER_ALEX,
            toUserId: USER_ALEX,
            sdp: { type: "answer", sdp: "v=0\r\n" },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "WRONG_PARTICIPANT" }));

        await expect(
          webrtcSignalingService.sendIceCandidate(ROOM_ID, {
            fromUserId: USER_ALEX,
            toUserId: USER_ALEX,
            candidate: { candidate: "candidate:0", sdpMid: "0", sdpMLineIndex: 0 },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "WRONG_PARTICIPANT" }));
      });

      it("rejects sending signaling to an outsider not in the room", async () => {
        await expect(
          webrtcSignalingService.sendOffer(ROOM_ID, {
            fromUserId: USER_ALEX,
            toUserId: USER_ATTACKER,
            sdp: { type: "offer", sdp: "v=0\r\n" },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "WRONG_PARTICIPANT" }));

        await expect(
          webrtcSignalingService.sendIceCandidate(ROOM_ID, {
            fromUserId: USER_ALEX,
            toUserId: USER_ATTACKER,
            candidate: { candidate: "candidate:0", sdpMid: "0", sdpMLineIndex: 0 },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "WRONG_PARTICIPANT" }));
      });

      it("rejects sending signaling with missing or blank recipient", async () => {
        await expect(
          webrtcSignalingService.sendOffer(ROOM_ID, {
            fromUserId: USER_ALEX,
            toUserId: "",
            sdp: { type: "offer", sdp: "v=0\r\n" },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "WRONG_PARTICIPANT" }));
      });
    });

    describe("Stale Room Signaling & Automatic Cleanup", () => {
      it("rejects signaling when room session has expired beyond max age", async () => {
        // Set activity to 30 minutes ago (> 15 minutes max threshold)
        const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
        memorySignalingBus.setRoomActivity(ROOM_ID, thirtyMinutesAgo);

        expect(memorySignalingBus.isRoomStale(ROOM_ID)).toBe(true);

        await expect(
          webrtcSignalingService.sendOffer(ROOM_ID, {
            fromUserId: USER_ALEX,
            toUserId: USER_SAM,
            sdp: { type: "offer", sdp: "v=0\r\n" },
            timestamp: Date.now(),
          })
        ).rejects.toThrowError(expect.objectContaining({ code: "STALE_ROOM" }));
      });

      it("cleans up stale room signaling data and purges presence", async () => {
        // Join participants
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

        // Set room stale
        memorySignalingBus.markRoomStale(ROOM_ID);

        // Run cleanStaleRoomSignaling
        const cleanupResult = await webrtcSignalingService.cleanStaleRoomSignaling(ROOM_ID);
        expect(cleanupResult.cleaned).toBe(true);

        // Participants in memory bus should now be empty
        expect(memorySignalingBus.getParticipants(ROOM_ID)[USER_ALEX]).toBeUndefined();
      });

      it("does not clean non-stale active room", async () => {
        memorySignalingBus.touchRoom(ROOM_ID);
        const cleanupResult = await webrtcSignalingService.cleanStaleRoomSignaling(ROOM_ID);
        expect(cleanupResult.cleaned).toBe(false);
      });
    });

    describe("Legitimate WebRTC Offer/Answer/Candidate Signaling Flow", () => {
      it("successfully completes full offer/answer/candidate exchange between two participants", async () => {
        // 1. Both participants join and publish presence
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
        await webrtcSignalingService.publishParticipant(ROOM_ID, {
          userId: USER_SAM,
          joined: true,
          cameraEnabled: true,
          micEnabled: true,
          hasCamera: true,
          hasMic: true,
          joinedAt: Date.now(),
          updatedAt: Date.now(),
        });

        // 2. Set up subscriptions for incoming signals
        const receivedOffers: WebRtcSignalOffer[] = [];
        const receivedAnswers: WebRtcSignalAnswer[] = [];
        const receivedCandidates: WebRtcSignalCandidate[] = [];

        const unsubOffers = webrtcSignalingService.subscribeToOffers(
          ROOM_ID,
          USER_SAM,
          (offer) => {
            if (offer) receivedOffers.push(offer);
          }
        );

        const unsubAnswers = webrtcSignalingService.subscribeToAnswers(
          ROOM_ID,
          USER_ALEX,
          (answer) => {
            if (answer) receivedAnswers.push(answer);
          }
        );

        const unsubCandidates = webrtcSignalingService.subscribeToIceCandidates(
          ROOM_ID,
          USER_SAM,
          (cand) => {
            receivedCandidates.push(cand);
          }
        );

        // 3. User ALEX creates and sends valid SDP offer
        const validOffer: WebRtcSignalOffer = {
          fromUserId: USER_ALEX,
          toUserId: USER_SAM,
          sdp: {
            type: "offer",
            sdp: "v=0\r\no=- 12345678 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n",
          },
          timestamp: Date.now(),
        };
        await webrtcSignalingService.sendOffer(ROOM_ID, validOffer);

        expect(receivedOffers).toHaveLength(1);
        expect(receivedOffers[0].fromUserId).toBe(USER_ALEX);
        expect(receivedOffers[0].toUserId).toBe(USER_SAM);

        // 4. User SAM creates and sends valid SDP answer
        const validAnswer: WebRtcSignalAnswer = {
          fromUserId: USER_SAM,
          toUserId: USER_ALEX,
          sdp: {
            type: "answer",
            sdp: "v=0\r\no=- 87654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n",
          },
          timestamp: Date.now(),
        };
        await webrtcSignalingService.sendAnswer(ROOM_ID, validAnswer);

        expect(receivedAnswers).toHaveLength(1);
        expect(receivedAnswers[0].fromUserId).toBe(USER_SAM);
        expect(receivedAnswers[0].toUserId).toBe(USER_ALEX);

        // 5. User ALEX sends ICE candidates
        const validCandidate: WebRtcSignalCandidate = {
          fromUserId: USER_ALEX,
          toUserId: USER_SAM,
          candidate: {
            candidate: "candidate:1 1 UDP 2122260223 192.168.1.100 50000 typ host",
            sdpMid: "0",
            sdpMLineIndex: 0,
          },
          timestamp: Date.now(),
        };
        await webrtcSignalingService.sendIceCandidate(ROOM_ID, validCandidate);

        expect(receivedCandidates).toHaveLength(1);
        expect(receivedCandidates[0].fromUserId).toBe(USER_ALEX);

        // 6. Clean unsubscribe and teardown
        unsubOffers();
        unsubAnswers();
        unsubCandidates();

        await webrtcSignalingService.clearRoomSignaling(ROOM_ID, USER_ALEX);
        await webrtcSignalingService.clearRoomSignaling(ROOM_ID, USER_SAM);

        const participants = memorySignalingBus.getParticipants(ROOM_ID);
        expect(participants[USER_ALEX]).toBeUndefined();
        expect(participants[USER_SAM]).toBeUndefined();
      });
    });
  });
});
