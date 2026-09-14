/**
 * WebRTC Architecture Types for TogetherPlay
 * Prepared for peer-to-peer video, audio, and low-latency haptic signaling.
 */

export type PeerConnectionStatus =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export type SignalingMessageType = "OFFER" | "ANSWER" | "ICE_CANDIDATE" | "HANGUP";

export interface SignalingMessage {
  roomId: string;
  senderId: string;
  type: SignalingMessageType;
  sdp?: string;
  candidate?: IceCandidatePayload;
  timestamp: number;
}

export interface WebRtcMediaState {
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  latencyMs: number;
  connectionStatus: PeerConnectionStatus;
}
