"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Shuffle } from "@/components/react-bits/Shuffle";
import { PhoneMockup } from "@/components/media/PhoneMockup";

export function HeroSection() {
  const reduced = useReducedMotion();

  return (
    <section id="top" className="section-snap relative flex min-h-[88vh] flex-col justify-center pt-28 pb-14">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 md:grid-cols-2 md:items-center md:gap-14">
        <motion.div
          className="flex flex-col gap-6"
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Shuffle
            as="h1"
            text="Private, local AI meets decentralized P2P swarm"
            className="max-w-xl font-[family-name:var(--font-proto)] text-3xl leading-tight text-head text-glow md:text-4xl"
          />
          <p className="max-w-lg text-lg leading-relaxed text-sub text-legible">
            Join a swarm of private, on-device agents capable of sharing inference and high-value data.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => document.getElementById("get")?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-sm border border-accent bg-accent/10 px-6 py-2.5 font-[family-name:var(--font-proto)] text-xs uppercase tracking-wide text-head transition-colors hover:border-accent hover:bg-accent/20"
            >
              Get Daemon
            </button>
            <a
              href="#agent"
              className="rounded-sm border border-line bg-card/40 px-6 py-2.5 font-[family-name:var(--font-proto)] text-xs uppercase tracking-wide text-sub transition-colors hover:border-line-hover hover:bg-card/70 hover:text-head"
            >
              How it works
            </a>
          </div>
        </motion.div>
        <div className="md:justify-self-end">
          <PhoneMockup
            screen="hero-home"
            alt="Daemon home screen showing Agent Control Deck"
            caption="Agent Control Deck"
            priority
          />
        </div>
      </div>
    </section>
  );
}
