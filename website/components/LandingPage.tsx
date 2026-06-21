"use client";

import { useEffect, useRef, useState } from "react";
import { AsciiHoverField } from "@/components/backgrounds/AsciiHoverField";
import { Footer } from "@/components/layout/Footer";
import { SiteNav } from "@/components/layout/SiteNav";
import { FaqSection } from "@/components/sections/FaqSection";
import { GetAppSection, SurfacesSection } from "@/components/sections/GetAppSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { HiveSection } from "@/components/sections/HiveSection";
import { HypercoreDataSection } from "@/components/sections/HypercoreDataSection";
import { IncentivesSection } from "@/components/sections/IncentivesSection";
import { LocalInferenceSection } from "@/components/sections/LocalInferenceSection";
import type { AsciiVariant } from "@/lib/ascii-field";

export function LandingPage() {
  const [asciiVariant, setAsciiVariant] = useState<AsciiVariant>("calm");
  const spiralActive = useRef(false);

  useEffect(() => {
    const hive = document.getElementById("hive");
    const datasets = document.getElementById("datasets");
    if (!hive || !datasets) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const inSpiralZone = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0.12);
        if (inSpiralZone === spiralActive.current) return;
        spiralActive.current = inSpiralZone;
        setAsciiVariant(inSpiralZone ? "spiral" : "calm");
      },
      { threshold: [0, 0.12, 0.25], rootMargin: "-15% 0px" },
    );

    observer.observe(hive);
    observer.observe(datasets);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0">
        <AsciiHoverField variant={asciiVariant} className="h-full w-full" opacity={0.38} />
        <div className="absolute inset-0 bg-black/30 dark:bg-black/55" aria-hidden />
      </div>
      <SiteNav />
      <main className="landing-main landing-scroll">
        <HeroSection />
        <LocalInferenceSection />
        <HiveSection />
        <HypercoreDataSection />
        <IncentivesSection />
        <SurfacesSection />
        <GetAppSection />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
}
