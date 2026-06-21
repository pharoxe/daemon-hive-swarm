import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Jura } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const jura = Jura({
  variable: "--font-jura",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const protoMono = IBM_Plex_Mono({
  variable: "--font-proto",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Daemon - Private AI on your device",
  description:
    "Daemon runs local inference with QVAC on your phone, connects you to the Hive P2P swarm, and shares anonymized datasets through Hypercore when you opt in.",
  metadataBase: new URL("https://daemon.example"),
  openGraph: {
    title: "Daemon - Private AI on your device",
    description:
      "Local agents, Hive compute sharing, and privacy-preserving datasets enabled by on-device inference.",
    images: [{ url: "/visuals/og-card.svg", width: 1200, height: 630, alt: "Daemon landing preview" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Daemon - Private AI on your device",
    description: "Local inference. Hive P2P agents. Hypercore datasets.",
    images: ["/visuals/og-card.svg"],
  },
  icons: {
    icon: "/visuals/display/daemon-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4eee7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${jura.variable} ${protoMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("daemon-theme");if(t==="light")document.documentElement.classList.remove("dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
