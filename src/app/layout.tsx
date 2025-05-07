import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chatterly!",
  icons: { 
    icon: "/Chatterly-WebIcon.ico",
    },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (

    <html lang="en">
      <body
        style={{ background: "#111", color: "#FFF", fontFamily: "sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
