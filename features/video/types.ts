import type { WebRtcCallStatus, WebRtcParticipant } from "@/types/domain";

export interface VideoDeviceState {
  hasCamera: boolean;
  hasMicrophone: boolean;
  cameraPermission: "prompt" | "granted" | "denied" | "unsupported";
  microphonePermission: "prompt" | "granted" | "denied" | "unsupported";
}

export interface UseWebRtcVideoCallReturn {
  // Call status
  status: WebRtcCallStatus;
  errorMessage: string | null;
  isInCall: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  isReconnecting: boolean;

  // Media state
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  hasCamera: boolean;
  hasMicrophone: boolean;
  isUsingDemoStream: boolean;

  // Partner participant info from signaling
  partnerParticipant: WebRtcParticipant | null;
  isPartnerCameraOn: boolean;
  isPartnerMicOn: boolean;

  // Actions
  startCall: (useDemoStream?: boolean) => Promise<void>;
  leaveCall: () => Promise<void>;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  retryConnection: () => Promise<void>;
}
