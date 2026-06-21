"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button, Card, CardBody } from "@rdna/radiants/components/core";
import { ScreenshotCarousel } from "@/components/media/ScreenshotCarousel";

export function SurfacesSection() {
  const reduced = useReducedMotion();

  return (
    <motion.section
      className="section-snap border-t border-line py-16 md:py-24"
      initial={reduced ? false : { opacity: 0, y: 20 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ duration: 0.5 }}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 md:gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="flex flex-col gap-5">
          <p className="font-[family-name:var(--font-proto)] text-xs uppercase tracking-[0.18em] text-accent">
            Inside the app
          </p>
          <h2 className="font-[family-name:var(--font-proto)] text-3xl text-head text-glow md:text-4xl">
            Simple controls. No terminal.
          </h2>
          <p className="max-w-xl text-lg text-sub text-legible">
            Download models, enable tools, and join the Hive from one screen.
          </p>
        </div>
        <ScreenshotCarousel className="lg:justify-end" />
      </div>
    </motion.section>
  );
}

export function GetAppSection() {
  const reduced = useReducedMotion();

  return (
    <motion.section
      id="get"
      className="section-snap border-t border-line py-16 md:py-24"
      initial={reduced ? false : { opacity: 0, y: 20 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ duration: 0.5 }}
    >
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="font-[family-name:var(--font-proto)] text-xs uppercase tracking-[0.18em] text-accent">
          Get Daemon
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-proto)] text-3xl text-head text-glow md:text-4xl">
          Start on Android.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-sub text-legible">
          Install the app, download a model, and run your first local agent in minutes.
        </p>
        <Card className="mx-auto mt-8 max-w-md">
          <CardBody className="flex flex-col items-center gap-4 p-6">
            <Button tone="accent" size="lg" rounded="sm" disabled focusableWhenDisabled>
              Launching soon
            </Button>
            <p className="text-sm text-mute text-legible">Alpha testing on Solana Seeker soon</p>
          </CardBody>
        </Card>
      </div>
    </motion.section>
  );
}
