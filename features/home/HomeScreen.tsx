"use client";

import React from "react";
import HomePage from "@/app/home/page";

/**
 * HomeScreen delegates directly to HomePage to maintain a single source of truth
 * for sanctuary data flow, loading states, and preset management.
 */
export function HomeScreen() {
  return <HomePage />;
}
