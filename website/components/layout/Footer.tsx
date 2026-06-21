import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t border-line bg-depth py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="font-[family-name:var(--font-proto)] text-sm uppercase tracking-wide text-head">Daemon</p>
          <p className="max-w-xl text-sm text-mute">
            Private local agents. Optional Hive participation. Raw prompts and documents stay on your device.
          </p>
        </div>
        <Separator />
        <p className="text-xs text-mute">
          Built with QVAC, Hyperswarm, and Hypercore. Solana and Solana Mobile integration in the mobile app.
        </p>
      </div>
    </footer>
  );
}
