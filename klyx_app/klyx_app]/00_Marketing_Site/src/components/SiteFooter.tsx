import { Link } from "react-router-dom";
import Container from "@/components/Container";
import Logo from "@/components/Logo";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-black/20">
      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo />
            <p className="mt-4 max-w-md text-sm text-white/70">
              Klyx is a modern streaming and IPTV platform. This is the official marketing website.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                to="/coming-soon?intent=login"
              >
                Login (soon)
              </Link>
              <Link
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                to="/coming-soon?intent=download"
              >
                Download (soon)
              </Link>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3 md:col-span-7">
            <div>
              <div className="text-sm font-semibold text-white">Product</div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li>
                  <Link className="transition hover:text-white" to="/">
                    Home
                  </Link>
                </li>
                <li>
                  <Link className="transition hover:text-white" to="/gallery">
                    Gallery
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Company</div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li>
                  <span className="cursor-not-allowed text-white/40">About (placeholder)</span>
                </li>
                <li>
                  <span className="cursor-not-allowed text-white/40">Contact (placeholder)</span>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Legal</div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li>
                  <span className="cursor-not-allowed text-white/40">Privacy (placeholder)</span>
                </li>
                <li>
                  <span className="cursor-not-allowed text-white/40">Terms (placeholder)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} Klyx. All rights reserved.</span>
          <span>Built for streaming and IPTV experiences.</span>
        </div>
      </Container>
    </footer>
  );
}

