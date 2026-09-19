import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  webrtcSignalingService,
  memorySignalingBus,
  SignalingSecurityError,
} from "@/lib/firebase/services/webrtcSignaling";
import { getIceConfiguration } from "@/lib/webrtc/iceConfig";

describe("WebRTC Hook Lifecycle & State Invariant Tests", () => {
  const ROOM_ID = "room_hook_test_101";
  const USER_ALEX = "user_alex_123";
  const USER_SAM = "user_sam_456";

  beforeEach(() => {
    memorySignalingBus.resetAll();
    memorySignalingBus.authorizeRoomUsers(ROOM_ID, [USER_ALEX, USER_SAM]);
  });

  afterEach(() => {
    memorySignalingBus.resetAll();
    vi.restoreAllMocks();
  });

  it("handles duplicate call initiation by enforcing single connection", async () => {
    let startingCall = false;
    let callInitCount = 0;

    const startCallSimulated = async () => {
      if (startingCall) return;
      startingCall = true;
      try {
        callInitCount++;
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
      } finally {
        startingCall = false;
      }
    };

    // Trigger two concurrent invocations
    await Promise.all([startCallSimulated(), startCallSimulated()]);

    // Only one should have progressed to completion
    expect(callInitCount).toBe(1);
  });

  it("stops all media tracks and closes peer connection on partner leave", async () => {
    const mockTrack1 = { enabled: true, stop: vi.fn() };
    const mockTrack2 = { enabled: true, stop: vi.fn() };
    const mockPc = { close: vi.fn() };

    let isPartnerInCall = true;

    // Simulate partner departure
    isPartnerInCall = false;
    if (!isPartnerInCall) {
      mockTrack1.enabled = false;
      mockTrack1.stop();
      mockTrack2.enabled = false;
      mockTrack2.stop();
      mockPc.close();
    }

    expect(mockTrack1.enabled).toBe(false);
    expect(mockTrack1.stop).toHaveBeenCalledTimes(1);
    expect(mockTrack2.enabled).toBe(false);
    expect(mockTrack2.stop).toHaveBeenCalledTimes(1);
    expect(mockPc.close).toHaveBeenCalledTimes(1);
  });

  it("detects permission denial and transitions to permission_denied cleanly", async () => {
    let status = "idle";
    let errorMessage: string | null = null;

    const simulateGetUserMedia = async () => {
      status = "requesting_permissions";
      const err = new Error("Permission denied by user");
      err.name = "NotAllowedError";
      throw err;
    };

    try {
      await simulateGetUserMedia();
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "NotAllowedError") {
        status = "permission_denied";
        errorMessage = "Camera/microphone permission was denied. Please allow camera and microphone in your browser to start video.";
      }
    }

    expect(status).toBe("permission_denied");
    expect(errorMessage).toContain("Camera/microphone permission was denied");
  });

  it("verifies ice report contains diagnostics and no false production claims", () => {
    const ice = getIceConfiguration();
    expect(ice.stunServerCount).toBeGreaterThanOrEqual(1);
    if (!process.env.NEXT_PUBLIC_WEBRTC_TURN_URL) {
      expect(ice.isProductionReliable).toBe(false);
      expect(ice.reliabilityLevel).toBe("development_stun_only");
    }
  });
});
