import Link from "next/link";
import type { HomeAttention } from "@/lib/home/query";
import { artworkSrc } from "@/lib/media/artwork-src";

export function AttentionCard({ items }: { items: HomeAttention[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="flex w-full shrink-0 flex-col gap-3 rounded-xl border border-sync-failed/35 bg-bg-raised p-5 lg:w-[420px]">
      <p className="text-label font-semibold uppercase leading-label tracking-label text-sync-failed">
        Needs attention
      </p>
      {items.map((item, index) => (
        <Link
          className={`flex items-center gap-3 py-2.5 ${
            index < items.length - 1 ? "border-b border-border" : ""
          }`}
          href={item.href}
          key={item.eventId}
        >
          {item.artworkUrl ? (
            // biome-ignore lint/performance/noImgElement: local artwork proxy
            <img
              alt=""
              className="h-14 w-10 shrink-0 rounded-sm object-cover bg-accent-dim"
              height={56}
              src={artworkSrc(item.artworkUrl, 80, 112)}
              width={40}
            />
          ) : (
            <div className="h-14 w-10 shrink-0 rounded-sm bg-accent-dim" />
          )}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-ui font-medium leading-[18px] text-fg">
              {item.title}
            </span>
            <span
              className={`truncate text-meta leading-meta ${
                item.tone === "failed"
                  ? "text-sync-failed"
                  : "text-sync-unmatched"
              }`}
            >
              {item.line}
            </span>
          </span>
        </Link>
      ))}
    </section>
  );
}
