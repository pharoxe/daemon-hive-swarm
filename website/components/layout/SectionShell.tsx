"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type SectionShellProps = {
  id: string;
  label: string;
  title: string;
  description?: string;
  bullets?: string[];
  children: React.ReactNode;
  copyExtra?: React.ReactNode;
  reverse?: boolean;
  className?: string;
};

export function SectionShell({
  id,
  label,
  title,
  description,
  bullets = [],
  children,
  copyExtra,
  reverse = false,
  className,
}: SectionShellProps) {
  const reduced = useReducedMotion();

  return (
    <motion.section
      id={id}
      className={cn("section-snap border-t border-line py-16 md:py-24", className)}
      initial={reduced ? false : { opacity: 0, y: 20 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 md:grid-cols-2 md:items-center md:gap-14">
        <div className={cn("flex flex-col gap-5", reverse ? "md:order-2" : "md:order-1")}>
          <p className="font-[family-name:var(--font-proto)] text-xs uppercase tracking-[0.18em] text-accent">
            {label}
          </p>
          <h2 className="font-[family-name:var(--font-proto)] text-3xl leading-tight text-head text-glow md:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="max-w-xl text-lg leading-relaxed text-sub text-legible">{description}</p>
          ) : null}
          {copyExtra}
          {bullets.length > 0 ? (
            <>
              <Separator />
              <ul className="flex flex-col gap-3 text-base text-main">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3 text-legible">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    {bullet}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <div className={cn("flex min-w-0 flex-col gap-6", reverse ? "md:order-1" : "md:order-2")}>{children}</div>
      </div>
    </motion.section>
  );
}
