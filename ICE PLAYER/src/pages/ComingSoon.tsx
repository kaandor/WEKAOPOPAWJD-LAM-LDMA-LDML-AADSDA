import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Download, LogIn } from "lucide-react";
import Container from "@/components/Container";
import Button from "@/components/Button";
import { cn } from "@/lib/utils";

type Intent = "login" | "download";

function normalizeIntent(value: string | null): Intent {
  if (value === "download") return "download";
  return "login";
}

export default function ComingSoon() {
  const [params] = useSearchParams();
  const intent = normalizeIntent(params.get("intent"));

  const title = intent === "download" ? "Download coming soon" : "Login coming soon";
  const Icon = intent === "download" ? Download : LogIn;

  return (
    <div className="py-16 sm:py-20">
      <Container>
        <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center">
          <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl sm:p-10">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl",
                  "bg-violet-700/15 ring-1 ring-violet-500/25",
                )}
              >
                <Icon className="h-5 w-5 text-violet-200" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  This is a placeholder route so the site structure is ready. When Klyx launches, this page can be replaced
                  with the real experience.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/">
                <Button className="w-full sm:w-auto">Back to Home</Button>
              </Link>
              <Link to="/gallery" className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full sm:w-auto">
                  View screenshots
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm font-semibold text-white">Preview placeholder</div>
              <p className="mt-1 text-sm text-white/70">A login form / download selector can be added here later.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/40">Email</div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/40">
                  Password
                </div>
                <button
                  type="button"
                  disabled
                  className="sm:col-span-2 rounded-xl bg-violet-700/40 px-4 py-3 text-sm font-medium text-white/60"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

