import type { Metadata } from "next";
import "../packages/accessibility-kit/src/styles.css";
import "./demo.css";

export const metadata: Metadata = {
  title: "MORPH | Accessible runtime observatory",
  description:
    "A split-screen demonstration of MORPH compiling a chaotic travel portal into an adaptive, verified control surface.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
