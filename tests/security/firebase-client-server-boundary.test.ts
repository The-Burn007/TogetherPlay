import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  getAdminApp,
  getAdminAuth,
  getAdminFirestore,
  getAdminDatabase,
  getAdminStorage,
  isAdminFirebaseConfigured,
  resetAdminInstancesForTesting,
} from "@/lib/firebase/server/admin";
import { serverGameRepository } from "@/lib/firebase/server/gameRepository";
import type { GameSession, GameState, GameResult } from "@/types/domain";

describe("Firebase Client / Server Architecture & Boundary Enforcement", () => {
  beforeEach(() => {
    resetAdminInstancesForTesting();
  });

  afterEach(() => {
    resetAdminInstancesForTesting();
  });

  describe("1. Static Analysis & Build-Time Boundary Verification", () => {
    it("guarantees no client component, hook, or browser library imports Firebase Admin SDK or server modules", () => {
      const rootDir = process.cwd();
      const forbiddenClientImports = [
        /from\s+["']firebase-admin(\/.*)?["']/,
        /from\s+["']@\/lib\/firebase\/server(\/.*)?["']/,
        /require\(["']firebase-admin(\/.*)?["']\)/,
        /require\(["']@\/lib\/firebase\/server(\/.*)?["']\)/,
      ];

      const clientDirectories = [
        path.join(rootDir, "components"),
        path.join(rootDir, "app"),
        path.join(rootDir, "lib"),
      ];

      const scannedFiles: string[] = [];

      function scanDir(dir: string) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          // Skip server-only paths, node_modules, and test files
          if (
            fullPath.includes(path.sep + "lib" + path.sep + "firebase" + path.sep + "server") ||
            fullPath.includes(path.sep + "app" + path.sep + "api") ||
            fullPath.includes("node_modules") ||
            fullPath.includes(".next") ||
            fullPath.includes("tests")
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
            scannedFiles.push(fullPath);
          }
        }
      }

      clientDirectories.forEach(scanDir);
      expect(scannedFiles.length).toBeGreaterThan(10);

      const violations: string[] = [];
      for (const filePath of scannedFiles) {
        const content = fs.readFileSync(filePath, "utf-8");
        for (const pattern of forbiddenClientImports) {
          if (pattern.test(content)) {
            violations.push(`${path.relative(rootDir, filePath)} matched ${pattern}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it("guarantees no server-side route or repository imports the browser Firebase Web SDK", () => {
      const rootDir = process.cwd();
      const forbiddenServerImports = [
        /from\s+["']@\/lib\/firebase\/client["']/,
        /from\s+["']\.\.\/client["']/,
        /from\s+["']\.\/client["']/,
        /from\s+["']firebase\/firestore["']/,
        /from\s+["']firebase\/database["']/,
        /from\s+["']firebase\/auth["']/,
        /from\s+["']firebase\/storage["']/,
        /from\s+["']firebase\/app["']/,
      ];

      const serverDirectories = [
        path.join(rootDir, "app", "api"),
        path.join(rootDir, "lib", "firebase", "server"),
      ];

      const scannedFiles: string[] = [];

      function scanDir(dir: string) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(".ts")) {
            scannedFiles.push(fullPath);
          }
        }
      }

      serverDirectories.forEach(scanDir);
      expect(scannedFiles.length).toBeGreaterThan(5);

      const violations: string[] = [];
      for (const filePath of scannedFiles) {
        const content = fs.readFileSync(filePath, "utf-8");
        for (const pattern of forbiddenServerImports) {
          if (pattern.test(content)) {
            violations.push(`${path.relative(rootDir, filePath)} matched ${pattern}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe("2. Server Admin SDK Singleton Lifecycle", () => {
    it("initializes Admin App exactly once per server process", () => {
      const app1 = getAdminApp();
      const app2 = getAdminApp();
      expect(app1).toBe(app2);
    });

    it("initializes Admin Firestore, Database, Auth, and Storage singletons exactly once", () => {
      const firestore1 = getAdminFirestore();
      const firestore2 = getAdminFirestore();
      expect(firestore1).toBe(firestore2);

      const db1 = getAdminDatabase();
      const db2 = getAdminDatabase();
      expect(db1).toBe(db2);

      const auth1 = getAdminAuth();
      const auth2 = getAdminAuth();
      expect(auth1).toBe(auth2);

      const storage1 = getAdminStorage();
      const storage2 = getAdminStorage();
      expect(storage1).toBe(storage2);
    });

    it("correctly identifies server configuration status", () => {
      expect(typeof isAdminFirebaseConfigured()).toBe("boolean");
      expect(isAdminFirebaseConfigured()).toBe(true);
    });
  });

  describe("3. Repository & Data Model Integrity", () => {
    it("preserves authoritative game repository in-memory isolation for tests and clean state handling", async () => {
      const testGameId = "test_boundary_game_1";
      const session: GameSession = {
        gameId: testGameId,
        gameType: "speed_duel",
        coupleId: "couple_boundary_1",
        playerIds: ["user_a", "user_b"],
        createdBy: "user_a",
        schemaVersion: 1,
        status: "playing",
        createdAt: new Date().toISOString(),
      };

      await serverGameRepository.saveGameSession(session);
      const retrieved = await serverGameRepository.getGameSession(testGameId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.gameId).toBe(testGameId);
      expect(retrieved?.coupleId).toBe("couple_boundary_1");

      const state: GameState = {
        gameId: testGameId,
        gameType: "speed_duel",
        status: "playing",
        currentRound: 1,
        maxRounds: 3,
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 60000,
        serverTimestamp: Date.now(),
        data: {},
        processedActionIds: {},
        isFinished: false,
        scores: { user_a: 5, user_b: 10 },
        version: 1,
      };

      await serverGameRepository.saveEphemeralGameState(state);
      const retrievedState = await serverGameRepository.getEphemeralGameState(testGameId);
      expect(retrievedState).not.toBeNull();
      expect(retrievedState?.scores.user_a).toBe(5);
      expect(retrievedState?.scores.user_b).toBe(10);
    });

    it("preserves GameResult schema and persistence integrity", async () => {
      const result: GameResult = {
        resultId: "res_boundary_1",
        gameId: "test_boundary_game_1",
        coupleId: "couple_boundary_1",
        gameType: "speed_duel",
        playerIds: ["user_a", "user_b"],
        finalScores: { user_a: 10, user_b: 8 },
        totalRounds: 3,
        durationSeconds: 60,
        winnerId: "user_a",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        serverTimestamp: Date.now(),
      };

      await serverGameRepository.saveGameResult(result);
      const retrievedResult = await serverGameRepository.getGameResult("res_boundary_1");
      expect(retrievedResult).not.toBeNull();
      expect(retrievedResult?.winnerId).toBe("user_a");
      expect(retrievedResult?.finalScores.user_a).toBe(10);
    });
  });
});
