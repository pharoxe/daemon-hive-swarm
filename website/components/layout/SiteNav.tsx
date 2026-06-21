"use client";

import { useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Button } from "@rdna/radiants/components/core";
import { useTheme } from "@/components/layout/ThemeProvider";
import { navIconUrls, NAV_ICON_SIZE } from "@/lib/screen-assets";
import { cn } from "@/lib/utils";

const links = [
  { href: "#agent", label: "Daemon Agent" },
  { href: "#hive", label: "Hive" },
  { href: "#datasets", label: "Datasets" },
  { href: "#incentives", label: "Incentives" },
  { href: "#faq", label: "FAQ" },
];

export function SiteNav() {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const icon = navIconUrls();

  return (
    <header className="fixed left-1/2 top-4 z-40 w-[min(1180px,calc(100vw-2rem))] -translate-x-1/2 border border-line bg-page/85 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <a href="#top" className="flex shrink-0 items-center gap-2 text-sm font-medium tracking-wide text-head text-glow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={icon.src}
            srcSet={icon.srcSet}
            alt=""
            width={NAV_ICON_SIZE}
            height={NAV_ICON_SIZE}
            className="nav-icon block shrink-0 rounded-md"
          />
          <span className="hidden sm:inline">Daemon</span>
        </a>
        <nav className="hidden items-center gap-4 lg:flex" aria-label="Primary">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs uppercase tracking-wide text-mute transition-colors hover:text-accent"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center border border-line bg-card text-main lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex size-9 items-center justify-center border border-line bg-card text-main transition-colors hover:border-line-hover hover:text-accent"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <Button href="#get" tone="accent" size="sm" rounded="sm" className="hidden sm:inline-flex">
            Get Daemon
          </Button>
        </div>
      </div>
      <nav
        className={cn(
          "mt-2 grid gap-1 border-t border-line pt-2 lg:hidden",
          open ? "grid" : "hidden",
        )}
        aria-label="Mobile"
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="px-2 py-2 text-sm uppercase tracking-wide text-mute hover:text-accent"
            onClick={() => setOpen(false)}
          >
            {link.label}
          </a>
        ))}
        <a href="#get" className="px-2 py-2 text-sm uppercase tracking-wide text-accent" onClick={() => setOpen(false)}>
          Get Daemon
        </a>
      </nav>
    </header>
  );
}
