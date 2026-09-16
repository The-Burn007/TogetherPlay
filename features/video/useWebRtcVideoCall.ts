"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  WebRtcCallStatus,
  WebRtcParticipant,
} from "@/types/domain";
import { webrtcSignalingService } from "@/lib/firebase/services/webrtcSignaling";
import { createAntiquarianDemoStream } from "./demoStreamGenerator";
import type { UseWebRtcVideoCallReturn } from "./types";

interface UseWebRtcVideoCallParams {
  roomId: string;
  myUserId: string;
  partnerId: string;
  myDisplayName?: string;
  myCity?: string;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export function useWebRtcVideoCall({
  roomId,
  myUserId,
  partnerId,
  myDisplayName = "Alex",
  myCity = "London",
}: UseWebRtcVideoCallParams): UseWebRtcVideoCallReturn {
  // Call status & Errors
  const [status, setStatus] = useState<WebRtcCallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInCall, setIsInCall] = useState(false);

  // Streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Media Track Controls
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [hasCamera, setHasCamera] = useState(true);
  const [hasMicrophone, setHasMicrophone] = useState(true);
  const [isUsingDemoStream, setIsUsingDemoStream] = useState(false);

  // Partner Participant State from Signaling
  const [partnerParticipant, setPartnerParticipant] = useState<WebRtcParticipant | null>(null);

  // Refs for persistent lifecycle cleanup
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const cleanupListenersRef = useRef<(() => void)[]>([]);
  const isInitiatorRef = useRef<boolean>(myUserId < partnerId);

  // Stop all media tracks strictly
  const stopAllMediaTracks = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      localStreamRef.current = null;
    }
    setLocalStream(null);
  }, []);

  // Close PeerConnection strictly
  const closePeerConnection = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    setRemoteStream(null);
  }, []);

  // Clean up all signaling listeners strictly
  const cleanUpSignalingListeners = useCallback(() => {
    cleanupListenersRef.current.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // ignore
      }
    });
    cleanupListenersRef.current = [];
  }, []);

  // Leave Call action
  const leaveCall = useCallback(async () => {
    stopAllMediaTracks();
    closePeerConnection();
    cleanUpSignalingListeners();

    try {
      await webrtcSignalingService.clearRoomSignaling(roomId, myUserId);
    } catch {
      // ignore
    }

    setIsInCall(false);
    setStatus("idle");
    setErrorMessage(null);
    setIsUsingDemoStream(false);
  }, [roomId, myUserId, stopAllMediaTracks, closePeerConnection, cleanUpSignalingListeners]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopAllMediaTracks();
      closePeerConnection();
      cleanUpSignalingListeners();
    };
  }, [stopAllMediaTracks, closePeerConnection, cleanUpSignalingListeners]);

  // Track & Toggle Camera
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const nextState = !isCameraOn;
      videoTracks.forEach((track) => {
        track.enabled = nextState;
      });
      setIsCameraOn(nextState);

      webrtcSignalingService.updateParticipant(roomId, myUserId, {
        cameraEnabled: nextState,
      }).catch(() => {});
    }
  }, [isCameraOn, roomId, myUserId]);

  // Track & Toggle Microphone
  const toggleMicrophone = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const nextState = !isMicOn;
      audioTracks.forEach((track) => {
        track.enabled = nextState;
      });
      setIsMicOn(nextState);

      webrtcSignalingService.updateParticipant(roomId, myUserId, {
        micEnabled: nextState,
      }).catch(() => {});
    }
  }, [isMicOn, roomId, myUserId]);

  // Start Call Implementation
  const startCall = useCallback(
    async (forceDemoStream = false) => {
      // Clean previous session if any
      stopAllMediaTracks();
      closePeerConnection();
      cleanUpSignalingListeners();

      setErrorMessage(null);
      setStatus("requesting_permissions");

      let stream: MediaStream | null = null;
      let usedDemo = forceDemoStream;

      // 1. Request Media Permission
      if (!forceDemoStream && typeof navigator !== "undefined" && navigator.mediaDevices) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          setHasCamera(true);
          setHasMicrophone(true);
        } catch (err: unknown) {
          const error = err as Error;
          const errorName = error.name || "";

          if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
            setStatus("permission_denied");
            setErrorMessage(
              "Camera/microphone permission was denied. Please allow camera and microphone in your browser to start video."
            );
            return;
          }

          if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
            // Check if one device exists (camera or mic)
            try {
              const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
              stream = audioOnlyStream;
              setHasCamera(false);
              setHasMicrophone(true);
              setStatus("no_camera");
            } catch {
              try {
                const videoOnlyStream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream = videoOnlyStream;
                setHasCamera(true);
                setHasMicrophone(false);
                setStatus("no_microphone");
              } catch {
                setHasCamera(false);
                setHasMicrophone(false);
                setStatus("no_camera");
                setErrorMessage("No physical camera or microphone detected on this device.");
                return;
              }
            }
          } else {
            // MediaDevices might be restricted by browser sandbox/iframe
            console.warn("[WebRTC] getUserMedia failed, offering demo companion feed fallback:", err);
            usedDemo = true;
          }
        }
      } else {
        usedDemo = true;
      }

      // If physical stream couldn't be created or fallback requested, generate synthetic feed
      if (!stream && usedDemo) {
        stream = createAntiquarianDemoStream(
          myDisplayName,
          myCity,
          myUserId === "user_alex" ? "amber" : "emerald"
        );
        setIsUsingDemoStream(true);
        setHasCamera(true);
        setHasMicrophone(true);
      }

      if (!stream) {
        setStatus("failed");
        setErrorMessage("Unable to initialize media stream.");
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraOn(true);
      setIsMicOn(true);
      setIsInCall(true);
      setStatus("connecting");

      // 2. Publish Participant Presence in RTDB
      try {
        await webrtcSignalingService.publishParticipant(roomId, {
          userId: myUserId,
          joined: true,
          cameraEnabled: true,
          micEnabled: true,
          hasCamera: true,
          hasMic: true,
          joinedAt: Date.now(),
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.warn("[WebRTC] Failed to publish participant:", err);
      }

      // 3. Create PeerConnection
      if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined") {
        // In SSR / non-browser environment
        setStatus("connected");
        return;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      queuedCandidatesRef.current = [];

      // Add local tracks to PeerConnection
      stream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, stream!);
        } catch (e) {
          console.warn("[WebRTC] addTrack warning:", e);
        }
      });

      // Handle remote media track
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Handle ICE Candidate generation
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          webrtcSignalingService.sendIceCandidate(roomId, {
            fromUserId: myUserId,
            toUserId: partnerId,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              usernameFragment: event.candidate.usernameFragment,
            },
            timestamp: Date.now(),
          }).catch(() => {});
        }
      };

      // Connection state monitors
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          setStatus("connected");
        } else if (state === "connecting") {
          setStatus("connecting");
        } else if (state === "disconnected") {
          setStatus("reconnecting");
        } else if (state === "failed") {
          setStatus("failed");
          setErrorMessage("PeerConnection failed. Network or firewall blocked P2P connection.");
        } else if (state === "closed") {
          setStatus("idle");
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === "connected" || state === "completed") {
          setStatus("connected");
        } else if (state === "disconnected") {
          setStatus("reconnecting");
        } else if (state === "failed") {
          setStatus("failed");
        }
      };

      // 4. Signaling Listeners
      // A. Participant listener
      const unsubParticipants = webrtcSignalingService.subscribeToParticipants(
        roomId,
        async (participants) => {
          const partner = participants[partnerId];
          setPartnerParticipant(partner || null);

          // If partner is present and we are initiator, create offer if not created
          if (partner && partner.joined && isInitiatorRef.current) {
            if (pc.signalingState === "stable") {
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await webrtcSignalingService.sendOffer(roomId, {
                  fromUserId: myUserId,
                  toUserId: partnerId,
                  sdp: { type: offer.type, sdp: offer.sdp || "" },
                  timestamp: Date.now(),
                });
              } catch (err) {
                console.warn("[WebRTC] createOffer error:", err);
              }
            }
          }
        }
      );

      // B. Offer listener (when partner sends offer to us)
      const unsubOffers = webrtcSignalingService.subscribeToOffers(
        roomId,
        myUserId,
        async (offer) => {
          if (!offer || offer.fromUserId !== partnerId) return;
          try {
            if (pc.signalingState !== "stable") {
              if (myUserId < partnerId) {
                // Ignore glare if we have priority
                return;
              }
              await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp as RTCSessionDescriptionInit));
            } else {
              await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp as RTCSessionDescriptionInit));
            }

            // Apply queued candidates
            while (queuedCandidatesRef.current.length > 0) {
              const cand = queuedCandidatesRef.current.shift();
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await webrtcSignalingService.sendAnswer(roomId, {
              fromUserId: myUserId,
              toUserId: partnerId,
              sdp: { type: answer.type, sdp: answer.sdp || "" },
              timestamp: Date.now(),
            });
          } catch (err) {
            console.warn("[WebRTC] Error handling offer:", err);
          }
        }
      );

      // C. Answer listener (when partner answers our offer)
      const unsubAnswers = webrtcSignalingService.subscribeToAnswers(
        roomId,
        myUserId,
        async (answer) => {
          if (!answer || answer.fromUserId !== partnerId) return;
          try {
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(answer.sdp as RTCSessionDescriptionInit));

              // Apply queued candidates
              while (queuedCandidatesRef.current.length > 0) {
                const cand = queuedCandidatesRef.current.shift();
                if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
            }
          } catch (err) {
            console.warn("[WebRTC] Error handling answer:", err);
          }
        }
      );

      // D. ICE candidate listener
      const unsubCandidates = webrtcSignalingService.subscribeToIceCandidates(
        roomId,
        myUserId,
        async (candidateMsg) => {
          if (!candidateMsg || candidateMsg.fromUserId !== partnerId) return;
          try {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(candidateMsg.candidate));
            } else {
              queuedCandidatesRef.current.push(candidateMsg.candidate);
            }
          } catch (err) {
            console.warn("[WebRTC] Error adding ICE candidate:", err);
          }
        }
      );

      cleanupListenersRef.current = [unsubParticipants, unsubOffers, unsubAnswers, unsubCandidates];

      // If we are initiator and partner is already present in RTDB, kick off offer
      if (isInitiatorRef.current) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await webrtcSignalingService.sendOffer(roomId, {
            fromUserId: myUserId,
            toUserId: partnerId,
            sdp: { type: offer.type, sdp: offer.sdp || "" },
            timestamp: Date.now(),
          });
        } catch (err) {
          console.warn("[WebRTC] Initial offer error:", err);
        }
      }
    },
    [
      roomId,
      myUserId,
      partnerId,
      myDisplayName,
      myCity,
      stopAllMediaTracks,
      closePeerConnection,
      cleanUpSignalingListeners,
    ]
  );

  const retryConnection = useCallback(async () => {
    await startCall(isUsingDemoStream);
  }, [startCall, isUsingDemoStream]);

  return {
    status,
    errorMessage,
    isInCall,
    isConnecting: status === "requesting_permissions" || status === "connecting",
    isConnected: status === "connected",
    isReconnecting: status === "reconnecting",
    localStream,
    remoteStream,
    isCameraOn,
    isMicOn,
    hasCamera,
    hasMicrophone,
    isUsingDemoStream,
    partnerParticipant,
    isPartnerCameraOn: partnerParticipant ? partnerParticipant.cameraEnabled : true,
    isPartnerMicOn: partnerParticipant ? partnerParticipant.micEnabled : true,
    startCall,
    leaveCall,
    toggleCamera,
    toggleMicrophone,
    retryConnection,
  };
}
