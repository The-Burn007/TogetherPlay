export type NavTab = "shared-room" | "game-lobby" | "realtime-moments" | "timeline-memories" | "couple-profile";

export interface NavItem {
  id: NavTab;
  label: string;
  href: string;
  iconName: string;
}

export type UIThemeMode = "dark";

export interface ToastMessage {
  id: string;
  message: string;
  type?: "info" | "success" | "nudge";
}
