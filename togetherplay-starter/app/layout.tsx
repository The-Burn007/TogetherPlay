import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TogetherPlay",
  description: "A multiplayer relationship game room for couples living apart.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
