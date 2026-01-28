import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Container from "@/components/Container";
import Button from "@/components/Button";
import FeatureCard from "@/components/FeatureCard";
import FaqAccordion from "@/components/FaqAccordion";
import { cn } from "@/lib/utils";
import { features, faqs, heroDeviceMockUrl, klyxCopy, screenshots } from "@/utils/klyxContent";

export default function Home() {
  const previewShots = screenshots.slice(0, 6);

  return (
    <>
      <section className="pb-14 pt-10 sm:pb-16 sm:pt-14">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                <CheckCircle2 className="h-4 w-4 text-violet-300" />
                {klyxCopy.tagline}
              </div>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {klyxCopy.heroTitle}
                <span className="text-violet-300">.</span>
              </h1>
              <p className="mt-4 text-base leading-7 text-white/80 sm:text-lg">{klyxCopy.heroSubtitle}</p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">{klyxCopy.heroBody}</p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link to="/coming-soon?intent=download" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto">Download</Button>
                </Link>
                <Link to="/coming-soon?intent=login" className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full sm:w-auto">
                    Login
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="mt-3 text-xs text-white/50">Login and downloads are placeholders for a future launch.</div>
            </div>

            <div className="relative">
              <div className="absolute -inset-3 rounded-3xl bg-violet-500/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl">
                <img
                  src={heroDeviceMockUrl}
                  alt="Klyx app preview"
                  className="block h-auto w-full"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section id="features" className="py-14 sm:py-16 scroll-mt-24">
        <Container>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Features</h2>
            <p className="max-w-2xl text-sm leading-6 text-white/70">
              A fast, modern foundation for streaming and IPTV—designed to scale into a full platform.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <FeatureCard key={f.title} title={f.title} description={f.description} icon={f.icon} />
            ))}
          </div>
        </Container>
      </section>

      <section id="screenshots" className="py-14 sm:py-16 scroll-mt-24">
        <Container>
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Screenshots</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                Explore key flows and UI patterns. Open the full gallery for filters and lightbox viewing.
              </p>
            </div>
            <Link
              to="/gallery"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2",
                "text-sm text-white/80 transition hover:bg-white/10 hover:text-white",
              )}
            >
              View all screenshots
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {previewShots.map((shot) => (
              <Link
                key={shot.id}
                to="/gallery"
                className={cn(
                  "group overflow-hidden rounded-2xl border border-white/10 bg-white/5",
                  "transition hover:bg-white/7 hover:shadow-md",
                )}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-black/30">
                  <img
                    src={shot.imageUrl}
                    alt={shot.title}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="p-5">
                  <div className="text-sm font-semibold text-white">{shot.title}</div>
                  <div className="mt-1 text-xs text-white/60">{shot.category}</div>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section id="faq" className="py-14 sm:py-16 scroll-mt-24">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">FAQ</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">Quick answers about the website and the Klyx roadmap.</p>
            </div>
            <div className="lg:col-span-8">
              <FaqAccordion items={faqs} />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
