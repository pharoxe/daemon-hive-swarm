"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Card, CardBody } from "@rdna/radiants/components/core";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What is Daemon?",
    a: "A private AI agent on your phone. It runs models locally and connects you to the Hive when you want to share compute or data.",
  },
  {
    q: "Does my data leave my phone?",
    a: "Not by default. Prompts and documents stay local. Dataset shares are anonymized on-device before anything is written to Hypercore.",
  },
  {
    q: "What is the Hive?",
    a: "A peer-to-peer network of Daemon agents. Phones find each other, share spare compute, and exchange only what you opt into.",
  },
  {
    q: "What is Hypercore?",
    a: "An append-only log for anonymized dataset records. It does not store your chat history or raw files.",
  },
  {
    q: "Do I need a wallet?",
    a: "No for local chat. Yes if you want onchain tools, agent funding, or contributor rewards.",
  },
  {
    q: "Can I use cloud models?",
    a: "Only if you add API keys and turn online mode on. Local inference is the default.",
  },
  {
    q: "How do rewards work?",
    a: "Opt into datasets or advertise compute. Validated contributions can settle as USDC pending in your agent wallet.",
  },
  {
    q: "Which devices work?",
    a: "Android phones with enough memory for QVAC local models. More devices as the runtime expands.",
  },
];

export function FaqSection() {
  const reduced = useReducedMotion();

  return (
    <motion.section
      id="faq"
      className="section-snap border-t border-line py-16 md:py-24"
      initial={reduced ? false : { opacity: 0, y: 20 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ duration: 0.5 }}
    >
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="font-[family-name:var(--font-proto)] text-3xl text-head text-glow">FAQ</h2>
        <Card className="mt-8">
          <CardBody className="px-6">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent>{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardBody>
        </Card>
      </div>
    </motion.section>
  );
}
