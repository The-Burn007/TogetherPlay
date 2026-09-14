import type { PartnerPresence, PartnerTelemetry } from "@/types/domain";

/**
 * Presence service contract via Firebase Realtime Database.
 * Decouples two-person presence sync, online detection, and typing/room beacons.
 */
export interface PresenceServiceContract {
  updateUserPresence(userId: string, telemetry: Partial<PartnerTelemetry>): Promise<void>;
  subscribeToPartnerPresence(partnerId: string, callback: (presence: PartnerPresence | null) => void): () => void;
  sendPartnerNudge(targetPartnerId: string, message: string): Promise<boolean>;
}

export class FirebasePresenceService implements PresenceServiceContract {
  private activePresence: PartnerPresence = {
    userId: "partner_sam",
    displayName: "Sam",
    colorRole: "sage",
    avatarUrl: "https://picsum.photos/seed/sam-profile-tokyo/200/200",
    telemetry: {
      city: "Tokyo",
      countryCode: "JP",
      localTime: "08:14",
      weather: "Clear Morning",
      temperatureCelsius: 21,
      isOnline: true,
      lastSeenMs: Date.now(),
      latencyMs: 28,
      statusState: "online",
      currentActivity: "Preparing for game session",
    },
  };

  async updateUserPresence(_userId: string, telemetry: Partial<PartnerTelemetry>): Promise<void> {
    this.activePresence.telemetry = {
      ...this.activePresence.telemetry,
      ...telemetry,
      lastSeenMs: Date.now(),
    };
  }

  subscribeToPartnerPresence(_partnerId: string, callback: (presence: PartnerPresence | null) => void): () => void {
    callback(this.activePresence);
    return () => {};
  }

  async sendPartnerNudge(_targetPartnerId: string, _message: string): Promise<boolean> {
    return true;
  }
}

export const presenceService = new FirebasePresenceService();
