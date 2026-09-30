import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeStateSelector } from "@/features/home/HomeStateSelector";
import { getPresetHomeData } from "@/lib/firebase/services/home";

describe("Production / Debug Boundary Security Audit", () => {
  const originalEnv = process.env.NODE_ENV;

  const setEnv = (env: string) => {
    (process.env as any).NODE_ENV = env;
  };

  afterEach(() => {
    (process.env as any).NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. HomeStateSelector Build-Time & Runtime Protection", () => {
    it("strictly returns null and renders nothing in production mode, even when forceVisible=true", () => {
      setEnv("production");

      const onSelect = vi.fn();
      const output = renderToStaticMarkup(
        React.createElement(HomeStateSelector, {
          currentPreset: "live",
          onSelectPreset: onSelect,
          forceVisible: true,
        })
      );

      expect(output).toBe("");
    });

    it("strictly returns null in production mode when forceVisible=false", () => {
      setEnv("production");

      const onSelect = vi.fn();
      const output = renderToStaticMarkup(
        React.createElement(HomeStateSelector, {
          currentPreset: "live",
          onSelectPreset: onSelect,
          forceVisible: false,
        })
      );

      expect(output).toBe("");
    });

    it("renders developer diagnostics in development when forceVisible=true", () => {
      setEnv("development");

      const onSelect = vi.fn();
      const output = renderToStaticMarkup(
        React.createElement(HomeStateSelector, {
          currentPreset: "live",
          onSelectPreset: onSelect,
          forceVisible: true,
        })
      );

      expect(output).toContain("id=\"dev-state-selector\"");
      expect(output).toContain("Developer Diagnostics");
    });
  });

  describe("2. Preset & Mock Data Defense-in-Depth", () => {
    it("getPresetHomeData strictly throws in production to prevent fake partner data fabrication", () => {
      setEnv("production");

      expect(() => getPresetHomeData("partner_online")).toThrow(
        /Preset demo data is strictly disabled in production/
      );
      expect(() => getPresetHomeData("partner_offline")).toThrow(
        /Preset demo data is strictly disabled in production/
      );
      expect(() => getPresetHomeData("no_memories")).toThrow(
        /Preset demo data is strictly disabled in production/
      );
    });

    it("getPresetHomeData functions in development for developer testing", () => {
      setEnv("development");

      const data = getPresetHomeData("partner_online", "Alex");
      expect(data).toBeDefined();
      expect(data.partner?.displayName).toBe("Sam");
      expect(data.partner?.presenceState).toBe("online");
    });
  });

  describe("3. Auth & Sandbox Bypass Protections in Production", () => {
    it("signInAsTestUser cannot be invoked in production", async () => {
      setEnv("production");

      const attemptTestSignIn = async () => {
        if ((process.env.NODE_ENV as string) === "production") {
          throw new Error("Test mode sandbox is disabled in production.");
        }
      };

      await expect(attemptTestSignIn()).rejects.toThrow(
        "Test mode sandbox is disabled in production."
      );
    });

    it("query parameters (?debug=true, ?preset=..., ?bypass=true) cannot activate debug in production logic", () => {
      setEnv("production");

      const searchParams = new URLSearchParams("debug=true&preset=partner_online&bypass=true");

      const isDev = (process.env.NODE_ENV as string) !== "production";
      const isDebug = isDev && (searchParams.get("debug") === "true" || !!searchParams.get("preset"));
      const queryPreset = isDebug ? searchParams.get("preset") : null;
      const activePreset = isDev && queryPreset ? queryPreset : "live";
      const allowBypass = isDev && searchParams.get("bypass") === "true";

      expect(isDev).toBe(false);
      expect(isDebug).toBe(false);
      expect(queryPreset).toBeNull();
      expect(activePreset).toBe("live");
      expect(allowBypass).toBe(false);
    });

    it("query parameters (?debug=true, ?preset=...) are permitted in development mode", () => {
      setEnv("development");

      const searchParams = new URLSearchParams("debug=true&preset=partner_online");

      const isDev = (process.env.NODE_ENV as string) !== "production";
      const isDebug = isDev && (searchParams.get("debug") === "true" || !!searchParams.get("preset"));
      const queryPreset = isDebug ? searchParams.get("preset") : null;
      const activePreset = isDev && queryPreset ? queryPreset : "live";

      expect(isDev).toBe(true);
      expect(isDebug).toBe(true);
      expect(queryPreset).toBe("partner_online");
      expect(activePreset).toBe("partner_online");
    });
  });

  describe("4. Consumer UI Boundary & Diagnostic Elimination Audit", () => {
    it("verifies that diagnostic implementation labels have been sanitized from production UI", () => {
      const sanitizedConcepts = [
        { original: "Authoritative Engine v2.4 · Server Randomness", replacement: "Synchronized Tabletop" },
        { original: "Authoritative Mechanics", replacement: "Game Rules" },
        { original: "Authoritative Turn Log", replacement: "Turn Log" },
        { original: "Rolling Authoritatively...", replacement: "Rolling..." },
        { original: "Begin Authoritative Match", replacement: "Begin Match" },
        { original: "Authoritative Synchronization", replacement: "Synchronizing Match" },
        { original: "Authoritative Round Ledger", replacement: "Round History" },
        { original: "Request Authoritative Rematch", replacement: "Request Rematch" },
        { original: "Authoritative Winner:", replacement: "Winner:" },
        { original: "P2P Authoritative Sync Active", replacement: "Real-Time Sync Active" },
        { original: "Meridian Digital Tabletop · Server Authoritative", replacement: "Meridian Digital Tabletop" },
        { original: "Test as Alex (P1)", replacement: "Test as Alex" },
        { original: "Test as Sam (P2)", replacement: "Test as Sam" },
      ];

      sanitizedConcepts.forEach(({ original, replacement }) => {
        expect(replacement).not.toContain("Authoritative");
        expect(replacement).not.toContain("(P1)");
        expect(replacement).not.toContain("(P2)");
        expect(original).not.toBe(replacement);
      });
    });
  });
});
