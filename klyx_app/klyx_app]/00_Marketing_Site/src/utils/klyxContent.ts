export type ScreenshotCategory = "All" | "Onboarding" | "Core" | "Settings";

// Use local screenshots instead of AI generation
function imgUrl(filename: string) {
  return `/screenshots/${filename}`;
}

export const klyxCopy = {
  tagline: "Modern streaming. Built for IPTV.",
  heroTitle: "Klyx",
  heroSubtitle:
    "A modern streaming and IPTV platform designed for speed, clarity, and the big screen.",
  heroBody:
    "Explore key features, preview real UI flows, and see what’s coming next. Login and downloads will be enabled in a future release.",
} as const;

export const features = [
  {
    title: "Fast, smooth playback",
    description:
      "Optimized UI and lightweight navigation so you can find and play content quickly.",
    icon: "PlayCircle",
  },
  {
    title: "IPTV-first experience",
    description:
      "Built around channels, EPG-style browsing, and quick switching between streams.",
    icon: "Tv",
  },
  {
    title: "Clean library & discovery",
    description:
      "Organize favorites, continue watching, and discover new content with ease.",
    icon: "Sparkles",
  },
  {
    title: "Profiles & preferences",
    description:
      "Personalize settings for different screens and viewers, with room to grow.",
    icon: "Users",
  },
  {
    title: "Device-ready design",
    description:
      "Responsive layout that looks great on desktop, tablet, and mobile.",
    icon: "Smartphone",
  },
  {
    title: "Built to expand",
    description:
      "Future login and downloads are planned—this site is ready for the next step.",
    icon: "Rocket",
  },
] as const;

export const faqs = [
  {
    question: "What is Klyx?",
    answer:
      "Klyx is a modern streaming and IPTV platform focused on a fast browsing experience and a clean, consistent UI.",
  },
  {
    question: "Is Klyx available to download today?",
    answer:
      "Not yet. This website includes a download placeholder that will be activated when the app is ready for public releases.",
  },
  {
    question: "Can I create an account or log in?",
    answer:
      "Login is planned. For now, the Login button routes to a Coming Soon page so the website structure is ready.",
  },
  {
    question: "Do you support IPTV playlists and EPG?",
    answer:
      "Klyx is designed for IPTV workflows. Feature details will be published as the product launch approaches.",
  },
  {
    question: "Which devices will be supported?",
    answer:
      "The product roadmap includes a device-first experience. Platform availability will be announced later.",
  },
  {
    question: "How can I stay updated?",
    answer:
      "For now, check back on this site. A newsletter or social links can be added when you’re ready.",
  },
] as const;

export type Screenshot = {
  id: string;
  title: string;
  category: Exclude<ScreenshotCategory, "All">;
  imageUrl: string;
};

const screenshotStyle =
  "modern IPTV streaming app UI, dark theme, purple accent, high contrast, clean typography, soft glow, professional product screenshot, sharp details";

export const screenshots: Screenshot[] = [
  {
    id: "onboarding-1",
    title: "Welcome screen",
    category: "Onboarding",
    imageUrl: imgUrl("welcome-screen.png"),
  },
  {
    id: "onboarding-2",
    title: "Sign-in placeholder",
    category: "Onboarding",
    imageUrl: imgUrl("sign-in.png"),
  },
  {
    id: "core-1",
    title: "Home dashboard",
    category: "Core",
    imageUrl: imgUrl("home-dashboard.png"),
  },
  {
    id: "core-2",
    title: "Channel guide",
    category: "Core",
    imageUrl: imgUrl("channel-guide.png"),
  },
  {
    id: "core-3",
    title: "Player controls",
    category: "Core",
    imageUrl: imgUrl("player-controls.png"),
  },
  {
    id: "settings-1",
    title: "Preferences",
    category: "Settings",
    imageUrl: imgUrl("preferences.png"),
  },
  {
    id: "settings-2",
    title: "Profiles",
    category: "Settings",
    imageUrl: imgUrl("profiles.png"),
  },
  {
    id: "settings-3",
    title: "Theme & display",
    category: "Settings",
    imageUrl: imgUrl("theme-display.png"),
  },
];

export const galleryCategories = [
  "All",
  "Onboarding",
  "Core",
  "Settings",
] as const satisfies readonly ScreenshotCategory[];

export const heroDeviceMockUrl = imgUrl("hero-mockup.png");
