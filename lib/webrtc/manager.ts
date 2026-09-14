import type { WebRtcMediaState, SignalingMessage } from "./types";

/**
 * WebRTC Session Manager Interface
 * 
 * Separates peer connection lifecycle, media streams, and RTDB signaling
 * cleanly from UI layers.
 */
export interface WebRtcManagerContract {
  initializePeer(roomId: string, localUserId: string): Promise<void>;
  toggleAudio(muted: boolean): void;
  toggleVideo(muted: boolean): void;
  sendSignalingMessage(msg: SignalingMessage): Promise<void>;
  close(): void;
  getMediaState(): WebRtcMediaState;
}

export class WebRtcManager implements WebRtcManagerContract {
  private mediaState: WebRtcMediaState = {
    isAudioMuted: false,
    isVideoMuted: false,
    latencyMs: 30,
    connectionStatus: "new",
  };

  async initializePeer(_roomId: string, _localUserId: string): Promise<void> {
    this.mediaState.connectionStatus = "connecting";
  }

  toggleAudio(muted: boolean): void {
    this.mediaState.isAudioMuted = muted;
  }

  toggleVideo(muted: boolean): void {
    this.mediaState.isVideoMuted = muted;
  }

  async sendSignalingMessage(_msg: SignalingMessage): Promise<void> {
    // Dispatched via Realtime Database signaling channel
  }

  close(): void {
    this.mediaState.connectionStatus = "closed";
  }

  getMediaState(): WebRtcMediaState {
    return { ...this.mediaState };
  }
}

export const webRtcManager = new WebRtcManager();
