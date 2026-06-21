"use client";

import { useState } from "react";
import { Tabs } from "@rdna/radiants/components/core";
import type { ScreenAssetId } from "@/lib/screen-assets";
import { PHONE_DISPLAY_WIDTH } from "@/lib/screen-assets";
import { cn } from "@/lib/utils";
import { PhoneMockup } from "./PhoneMockup";

const slides: {
  id: string;
  label: string;
  screen: ScreenAssetId;
  alt: string;
  caption: string;
}[] = [
  { id: "home", label: "Home", screen: "hero-home", alt: "Daemon Agent Control Deck", caption: "Agent Control Deck" },
  { id: "chat", label: "Chat", screen: "chat-local", alt: "Daemon local chat", caption: "Private local chat" },
  { id: "models", label: "Models", screen: "onboarding-model", alt: "Daemon model downloads", caption: "Downloadable models" },
  { id: "hive", label: "Hive", screen: "hive-datasets", alt: "Hive dataset marketplace", caption: "Data marketplace" },
  { id: "rewards", label: "Rewards", screen: "hive-rewards", alt: "Contributor rewards and wallet", caption: "Wallet and rewards" },
];

export function ScreenshotCarousel({ className }: { className?: string }) {
  const [active, setActive] = useState("home");
  const slide = slides.find((item) => item.id === active) ?? slides[0];

  return (
    <div className={cn("flex w-full justify-center", className)}>
      <div className="flex shrink-0 flex-col items-center" style={{ width: PHONE_DISPLAY_WIDTH }}>
        <Tabs value={active} onValueChange={setActive} className="screenshot-tabs w-full">
          <Tabs.List className="!mb-4 !flex !w-full !self-stretch gap-0.5 p-1 [&_[role=tab]]:min-w-0 [&_[role=tab]]:flex-1 [&_[role=tab]]:justify-center [&_[role=tab]]:px-1 [&_[role=tab]]:text-[10px]">
            {slides.map((item) => (
              <Tabs.Trigger key={item.id} value={item.id}>
                {item.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
        <PhoneMockup screen={slide.screen} alt={slide.alt} caption={slide.caption} />
      </div>
    </div>
  );
}
