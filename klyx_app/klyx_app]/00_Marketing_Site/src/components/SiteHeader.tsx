import { Link, NavLink, useLocation } from "react-router-dom";
import { Download, GalleryHorizontalEnd, LogIn } from "lucide-react";
import Button from "@/components/Button";
import Container from "@/components/Container";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";

type Props = {
  showAnchors?: boolean;
};

export default function SiteHeader({ showAnchors }: Props) {
  const location = useLocation();
  const onHome = location.pathname === "/";
  const shouldShowAnchors = showAnchors ?? onHome;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "text-sm text-white/70 transition hover:text-white",
      isActive ? "text-white" : "",
    );

  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0F17]/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-3">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {shouldShowAnchors ? (
            <>
              <a className="text-sm text-white/70 transition hover:text-white" href="#features">
                Features
              </a>
              <a className="text-sm text-white/70 transition hover:text-white" href="#screenshots">
                Screenshots
              </a>
              <a className="text-sm text-white/70 transition hover:text-white" href="#faq">
                FAQ
              </a>
            </>
          ) : null}
          <NavLink className={navLinkClass} to="/gallery">
            <span className="inline-flex items-center gap-2">
              <GalleryHorizontalEnd className="h-4 w-4" />
              Gallery
            </span>
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/coming-soon?intent=login" aria-label="Login (coming soon)">
            <Button variant="secondary" className="hidden sm:inline-flex">
              <LogIn className="h-4 w-4" />
              Login
            </Button>
            <Button variant="secondary" className="sm:hidden" aria-label="Login">
              <LogIn className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/coming-soon?intent=download" aria-label="Download (coming soon)">
            <Button className="hidden sm:inline-flex">
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button className="sm:hidden" aria-label="Download">
              <Download className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Container>
    </div>
  );
}

