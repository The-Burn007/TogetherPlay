import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";
import * as path from "path";
import * as net from "net";
import { spawn, ChildProcess } from "child_process";

async function isPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

describe("Firebase Realtime Database Security Rules", () => {
  let testEnv: RulesTestEnvironment;
  let emulatorProcess: ChildProcess | null = null;
  let emulatorAvailable = true;
  const rulesPath = path.resolve(process.cwd(), "database.rules.json");
  const rules = fs.readFileSync(rulesPath, "utf8");

  beforeAll(async () => {
    let portOpen = await isPortOpen(9000);
    if (!portOpen) {
      // Spawn local database emulator if not already running
      try {
        emulatorProcess = spawn(
          "firebase",
          ["emulators:start", "--only", "database"],
          { stdio: "ignore", detached: true }
        );
      } catch {
        // CLI not installed or cannot spawn
      }

      // Wait briefly for emulator to be ready
      const start = Date.now();
      while (Date.now() - start < 2500) {
        if (await isPortOpen(9000)) {
          portOpen = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    if (!portOpen) {
      emulatorAvailable = false;
      console.warn("[RTDB-Rules] Firebase RTDB Emulator is not running on port 9000. Skipping live emulator tests.");
      return;
    }

    testEnv = await initializeTestEnvironment({
      projectId: "demo-togetherplay-rules",
      database: {
        host: "127.0.0.1",
        port: 9000,
        rules,
      },
    });
  }, 25000);

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
    if (emulatorProcess && emulatorProcess.pid) {
      try {
        process.kill(-emulatorProcess.pid, "SIGTERM");
      } catch {
        emulatorProcess.kill("SIGTERM");
      }
    }
  });

  beforeEach(async (context) => {
    if (!emulatorAvailable || !testEnv) {
      context.skip();
      return;
    }
    await testEnv.clearDatabase();
  });

  describe("Server-Authoritative Game State Access Control", () => {
    const gameId = "game_couple_alpha";
    const playerA = "user_player_a";
    const playerB = "user_player_b";
    const playerC = "user_player_c_outsider";

    beforeEach(async () => {
      // Server-authoritative write using admin context (bypasses security rules)
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.database();
        await adminDb.ref(`gameStates/${gameId}`).set({
          gameId,
          gameType: "couple_race",
          status: "playing",
          currentRound: 1,
          maxRounds: 3,
          version: 1,
          scores: {
            [playerA]: 10,
            [playerB]: 15,
          },
          playerIds: [playerA, playerB],
          allowedPlayers: {
            [playerA]: true,
            [playerB]: true,
          },
          serverTimestamp: Date.now(),
        });
      });
    });

    it("Player A can read own game state", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();
      await assertSucceeds(aliceDb.ref(`gameStates/${gameId}`).get());
    });

    it("Player B can read own game state", async () => {
      const bobDb = testEnv.authenticatedContext(playerB).database();
      await assertSucceeds(bobDb.ref(`gameStates/${gameId}`).get());
    });

    it("Player C (another couple / outsider) cannot read Player A & B's game state", async () => {
      const charlieDb = testEnv.authenticatedContext(playerC).database();
      await assertFails(charlieDb.ref(`gameStates/${gameId}`).get());
    });

    it("Unauthenticated user cannot read game state", async () => {
      const unauthDb = testEnv.unauthenticatedContext().database();
      await assertFails(unauthDb.ref(`gameStates/${gameId}`).get());
    });

    it("No client can write or tamper with authoritative game state", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();
      const bobDb = testEnv.authenticatedContext(playerB).database();
      const charlieDb = testEnv.authenticatedContext(playerC).database();
      const unauthDb = testEnv.unauthenticatedContext().database();

      // Client attempting to overwrite score
      await assertFails(
        aliceDb.ref(`gameStates/${gameId}/scores/${playerA}`).set(999)
      );

      // Client attempting to declare winner
      await assertFails(
        bobDb.ref(`gameStates/${gameId}/winnerId`).set(playerB)
      );

      // Client attempting to delete game state
      await assertFails(
        charlieDb.ref(`gameStates/${gameId}`).remove()
      );

      // Unauthenticated client attempting to write
      await assertFails(
        unauthDb.ref(`gameStates/${gameId}`).set({ hacked: true })
      );
    });

    it("Strictly denies all client read and write access to privateGameStates node", async () => {
      // Seed secret in privateGameStates via admin context
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.database();
        await adminDb.ref(`privateGameStates/${gameId}`).set({
          gameId,
          targetId: "secret_artifact",
          targetCode: "#999",
        });
      });

      const aliceDb = testEnv.authenticatedContext(playerA).database();
      const bobDb = testEnv.authenticatedContext(playerB).database();
      const unauthDb = testEnv.unauthenticatedContext().database();

      // Even active players cannot read private state
      await assertFails(aliceDb.ref(`privateGameStates/${gameId}`).get());
      await assertFails(bobDb.ref(`privateGameStates/${gameId}`).get());
      await assertFails(aliceDb.ref(`privateGameStates/${gameId}/targetId`).get());
      await assertFails(unauthDb.ref(`privateGameStates/${gameId}`).get());

      // No client can write to private state
      await assertFails(aliceDb.ref(`privateGameStates/${gameId}`).set({ targetId: "tamper" }));
      await assertFails(unauthDb.ref(`privateGameStates/${gameId}`).set({ targetId: "tamper" }));
    });
  });

  describe("WebRTC Signaling Authorization", () => {
    const roomId = "room_couple_alpha";
    const playerA = "user_player_a";
    const playerB = "user_player_b";
    const playerC = "user_player_c_outsider";

    beforeEach(async () => {
      // Seed pre-authorized participants or authorizedUsers in the signaling room
      await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        const adminDb = adminCtx.database();
        await adminDb.ref(`webrtc_signaling/${roomId}/authorizedUsers`).set({
          [playerA]: true,
          [playerB]: true,
        });
      });
    });

    it("Player A can publish presence in own signaling room", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();
      await assertSucceeds(
        aliceDb.ref(`webrtc_signaling/${roomId}/participants/${playerA}`).set({
          userId: playerA,
          joinedAt: Date.now(),
        })
      );
    });

    it("Player A can send WebRTC offer to Player B", async () => {
      // Alice joins
      const aliceDb = testEnv.authenticatedContext(playerA).database();
      await aliceDb.ref(`webrtc_signaling/${roomId}/participants/${playerA}`).set({
        userId: playerA,
        joinedAt: Date.now(),
      });

      // Alice creates offer for Bob
      await assertSucceeds(
        aliceDb.ref(`webrtc_signaling/${roomId}/offers/${playerB}`).set({
          type: "offer",
          sdp: "v=0\r\no=alice 123456...",
          fromUserId: playerA,
          toUserId: playerB,
        })
      );
    });

    it("Player B can read WebRTC offer addressed to them", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();
      const bobDb = testEnv.authenticatedContext(playerB).database();

      // Alice joins and sets offer
      await aliceDb.ref(`webrtc_signaling/${roomId}/participants/${playerA}`).set({
        userId: playerA,
        joinedAt: Date.now(),
      });
      await aliceDb.ref(`webrtc_signaling/${roomId}/offers/${playerB}`).set({
        type: "offer",
        sdp: "v=0\r\no=alice 123456...",
        fromUserId: playerA,
        toUserId: playerB,
      });

      // Bob reads offer
      await assertSucceeds(
        bobDb.ref(`webrtc_signaling/${roomId}/offers/${playerB}`).get()
      );
    });

    it("Player C cannot access Player A & B's signaling room", async () => {
      const charlieDb = testEnv.authenticatedContext(playerC).database();

      // Charlie cannot read room metadata
      await assertFails(
        charlieDb.ref(`webrtc_signaling/${roomId}`).get()
      );

      // Charlie cannot read participants
      await assertFails(
        charlieDb.ref(`webrtc_signaling/${roomId}/participants`).get()
      );

      // Charlie cannot read offers
      await assertFails(
        charlieDb.ref(`webrtc_signaling/${roomId}/offers/${playerB}`).get()
      );

      // Charlie cannot inject an offer into this couple's room
      await assertFails(
        charlieDb.ref(`webrtc_signaling/${roomId}/offers/${playerB}`).set({
          type: "offer",
          sdp: "v=0\r\no=charlie_injected...",
          fromUserId: playerC,
          toUserId: playerB,
        })
      );

      // Charlie cannot inject self as participant into an authorized room
      await assertFails(
        charlieDb.ref(`webrtc_signaling/${roomId}/participants/${playerC}`).set({
          userId: playerC,
          joinedAt: Date.now(),
        })
      );
    });
  });

  describe("User Presence & Location Privacy", () => {
    const playerA = "user_player_a";
    const playerB = "user_player_b";
    const playerC = "user_player_c_outsider";

    it("Authorized user can update their own presence status", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();
      await assertSucceeds(
        aliceDb.ref(`presence/${playerA}`).set({
          online: true,
          lastSeen: Date.now(),
        })
      );
    });

    it("Unauthorized user cannot modify presence for another user", async () => {
      const charlieDb = testEnv.authenticatedContext(playerC).database();

      // Charlie cannot overwrite Alice's presence
      await assertFails(
        charlieDb.ref(`presence/${playerA}`).set({
          online: false,
          lastSeen: 0,
        })
      );
    });

    it("Clients cannot inject sensitive GPS / location fields into presence", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();

      // Attempting to store latitude / longitude in presence is rejected
      await assertFails(
        aliceDb.ref(`presence/${playerA}`).set({
          online: true,
          latitude: 37.7749,
          longitude: -122.4194,
        })
      );
    });

    it("Authenticated partner can read partner presence", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();
      const bobDb = testEnv.authenticatedContext(playerB).database();

      await aliceDb.ref(`presence/${playerA}`).set({
        userId: playerA,
        partnerId: playerB,
        authorizedUsers: { [playerA]: true, [playerB]: true },
        online: true,
        lastSeen: Date.now(),
      });

      await assertSucceeds(
        bobDb.ref(`presence/${playerA}`).get()
      );
    });

    it("Third authenticated user (outsider) CANNOT read another couple's presence", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();
      const charlieDb = testEnv.authenticatedContext(playerC).database();

      await aliceDb.ref(`presence/${playerA}`).set({
        userId: playerA,
        partnerId: playerB,
        authorizedUsers: { [playerA]: true, [playerB]: true },
        online: true,
        lastSeen: Date.now(),
      });

      // Charlie is an outsider (neither Alice nor Bob) -> reading Alice's presence MUST FAIL
      await assertFails(
        charlieDb.ref(`presence/${playerA}`).get()
      );
    });

    it("Unauthenticated user CANNOT read presence", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();
      const unauthDb = testEnv.unauthenticatedContext().database();

      await aliceDb.ref(`presence/${playerA}`).set({
        userId: playerA,
        partnerId: playerB,
        authorizedUsers: { [playerA]: true, [playerB]: true },
        online: true,
        lastSeen: Date.now(),
      });

      await assertFails(
        unauthDb.ref(`presence/${playerA}`).get()
      );
    });

    it("Cannot spoof userId in presence payload", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();

      // Alice tries to spoof userId as playerB
      await assertFails(
        aliceDb.ref(`presence/${playerA}`).set({
          userId: playerB,
          partnerId: playerB,
          online: true,
        })
      );
    });

    it("Cannot spoof partnerId with own uid", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();

      // Alice tries to self-partner
      await assertFails(
        aliceDb.ref(`presence/${playerA}`).set({
          userId: playerA,
          partnerId: playerA,
          online: true,
        })
      );
    });

    it("Client-provided timestamp cannot be spoofed as authoritative server timestamp for lastSeenMs", async () => {
      const aliceDb = testEnv.authenticatedContext(playerA).database();

      // Client attempting to provide a fake numeric timestamp for lastSeenMs instead of serverTimestamp()
      await assertFails(
        aliceDb.ref(`presence/${playerA}`).set({
          userId: playerA,
          partnerId: playerB,
          lastSeenMs: 123456789,
        })
      );
    });
  });
});
