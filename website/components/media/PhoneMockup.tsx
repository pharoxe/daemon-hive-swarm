"use client";

import { useId } from "react";
import { PHONE_DISPLAY_HEIGHT, PHONE_DISPLAY_WIDTH, screenAssetUrls, type ScreenAssetId } from "@/lib/screen-assets";
import { cn } from "@/lib/utils";

export { PHONE_DISPLAY_WIDTH, PHONE_DISPLAY_HEIGHT };

type PhoneMockupProps = {
  /** Base name of pre-scaled assets in /public/screens/display/ */
  screen: ScreenAssetId;
  alt: string;
  caption?: string;
  priority?: boolean;
  className?: string;
};

export function PhoneMockup({ screen, alt, caption, priority = false, className }: PhoneMockupProps) {
  const frameId = useId().replace(/:/g, "");
  const { src, srcSet } = screenAssetUrls(screen);

  return (
    <figure
      className={cn("phone-mockup mx-auto flex shrink-0 flex-col items-center gap-3", className)}
      style={{ width: PHONE_DISPLAY_WIDTH }}
    >
      <div className="overflow-hidden rounded-[26px] border border-line bg-card shadow-[0_0_40px_rgba(194,106,58,0.12)]">
        {/* Pre-scaled PNGs: browser displays 1:1 at 270px with no runtime downscale. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          id={frameId}
          src={src}
          srcSet={srcSet}
          alt={alt}
          width={PHONE_DISPLAY_WIDTH}
          height={PHONE_DISPLAY_HEIGHT}
          loading={priority ? "eager" : "lazy"}
          decoding="sync"
          draggable={false}
          className="phone-screenshot block"
        />
      </div>
      {caption ? (
        <figcaption className="text-center font-[family-name:var(--font-proto)] text-xs uppercase tracking-wide text-mute text-legible">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
