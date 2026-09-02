"use client";

import { useState } from "react";

/**
 * Posts to the one mailer on negiventures.com rather than carrying its own
 * Resend key. The receiving route reads the site from the Origin header, so
 * the email says which property the enquiry came from without this component
 * having to be told. `source` only adds finer detail (which page).
 */
const ENDPOINT =
  process.env.NEXT_PUBLIC_CONTACT_ENDPOINT ??
  "https://www.negiventures.com/api/contact";

type State = "idle" | "sending" | "sent" | "error";

export default function ContactCard({
  title,
  pitch,
  container = "max-w-5xl",
}: {
  title: string;
  pitch: string;
  /** Match the host page's container so the left edges line up. */
  container?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    setState("sending");
    setError("");

    const path = typeof window !== "undefined" ? window.location.pathname : "/";

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          company: fd.get("company"),
          message: fd.get("message"),
          company_website: fd.get("company_website"),
          source: path === "/" ? "" : path,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      form.reset();
      setState("sent");
    } catch {
      setError("Couldn't reach the server. Please try again shortly.");
      setState("error");
    }
  }

  const field =
    "w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px] text-fg transition-colors outline-none placeholder:text-dim focus-visible:border-fg focus-visible:ring-1 focus-visible:ring-fg/40";

  return (
    <section id="contact" className="border-t border-line">
      <div className={`mx-auto ${container} px-6 py-20`}>
        {/* Two columns from lg. A max-w-2xl block alone left a dead half-page
            beside it on the wide dashboard container. */}
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div className="max-w-xl">
            <p className="font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
              Build something like this
            </p>
            <h2 className="mt-3 text-[26px] font-semibold tracking-tight text-fg sm:text-[30px]">
              {title}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              {pitch}
            </p>
          </div>

          <div className="min-w-0">
            {state === "sent" ? (
              <div
                role="status"
                className="rounded-xl border border-line bg-white/[0.02] px-5 py-6"
              >
                <p className="text-[15px] font-medium text-fg">Message sent.</p>
                <p className="mt-1 text-[14px] text-muted">
                  You&rsquo;ll get a reply at the address you gave, usually
                  within a day or two.
                </p>
              </div>
            ) : (
              <form
                onSubmit={onSubmit}
                className="rounded-xl border border-line bg-white/[0.02] p-5 sm:p-6"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="c-name"
                      className="mb-1.5 block text-[13px] text-muted"
                    >
                      Name
                    </label>
                    <input
                      id="c-name"
                      name="name"
                      required
                      maxLength={100}
                      autoComplete="name"
                      className={field}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="c-email"
                      className="mb-1.5 block text-[13px] text-muted"
                    >
                      Email
                    </label>
                    <input
                      id="c-email"
                      name="email"
                      type="email"
                      required
                      maxLength={200}
                      autoComplete="email"
                      className={field}
                      placeholder="you@company.com"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="c-company"
                    className="mb-1.5 block text-[13px] text-muted"
                  >
                    Company <span className="text-dim">(optional)</span>
                  </label>
                  <input
                    id="c-company"
                    name="company"
                    maxLength={120}
                    autoComplete="organization"
                    className={field}
                    placeholder="Where you work"
                  />
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="c-message"
                    className="mb-1.5 block text-[13px] text-muted"
                  >
                    What are you building?
                  </label>
                  <textarea
                    id="c-message"
                    name="message"
                    required
                    rows={4}
                    maxLength={4000}
                    className={`${field} resize-y`}
                    placeholder="A couple of lines about the system and where it hurts."
                  />
                </div>

                {/* Honeypot: visually and programmatically hidden from real users. */}
                <div className="hidden" aria-hidden>
                  <label htmlFor="c-company-website">Company website</label>
                  <input
                    id="c-company-website"
                    name="company_website"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    disabled={state === "sending"}
                    className="rounded-full bg-fg px-5 py-2.5 text-[14px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {state === "sending" ? "Sending…" : "Send message"}
                  </button>
                  <p aria-live="polite" className="text-[13px] text-muted">
                    {state === "error" ? (
                      <span className="text-red-400">{error}</span>
                    ) : (
                      "Goes straight to my inbox."
                    )}
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
