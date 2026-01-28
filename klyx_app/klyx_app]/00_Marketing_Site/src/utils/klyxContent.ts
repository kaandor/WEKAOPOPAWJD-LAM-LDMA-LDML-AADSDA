export type ScreenshotCategory = "All" | "Onboarding" | "Core" | "Settings";

function imgUrl(prompt: string, imageSize: string) {
  return `https://coreva-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    prompt,
  )}&image_size=${encodeURIComponent(imageSize)}`;
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
    imageUrl: imgUrl(
      `${screenshotStyle}, onboarding welcome screen, brand name Klyx, two CTA buttons login and download, minimal layout, 16:9`,
      "landscape_16_9",
    ),
  },
  {
    id: "onboarding-2",
    title: "Sign-in placeholder",
    category: "Onboarding",
    imageUrl: imgUrl(
      `${screenshotStyle}, sign in form placeholder, email field, password field, remember me, subtle glass card, 4:3`,
      "landscape_4_3",
    ),
  },
  {
    id: "core-1",
    title: "Home dashboard",
    category: "Core",
    imageUrl: imgUrl(
      `${screenshotStyle}, streaming home dashboard, featured banner, continue watching row, channels row, navigation sidebar, 16:9`,
      "landscape_16_9",
    ),
  },
  {
    id: "core-2",
    title: "Channel guide",
    category: "Core",
    imageUrl: imgUrl(
      `${screenshotStyle}, IPTV channel guide grid, channel logos column, program timeline, highlighted current program, 16:9`,
      "landscape_16_9",
    ),
  },
  {
    id: "core-3",
    title: "Player controls",
    category: "Core",
    imageUrl: imgUrl(
      `${screenshotStyle}, video player UI overlay, live badge, playback controls, quality selector, minimal control bar, 4:3`,
      "landscape_4_3",
    ),
  },
  {
    id: "settings-1",
    title: "Preferences",
    category: "Settings",
    imageUrl: imgUrl(
      `${screenshotStyle}, settings page, tabs for playback, subtitles, network, toggles and dropdowns, 4:3`,
      "landscape_4_3",
    ),
  },
  {
    id: "settings-2",
    title: "Profiles",
    category: "Settings",
    imageUrl: imgUrl(
      `${screenshotStyle}, profiles management screen, avatar cards, add profile button, clean grid, 4:3`,
      "landscape_4_3",
    ),
  },
  {
    id: "settings-3",
    title: "Theme & display",
    category: "Settings",
    imageUrl: imgUrl(
      `${screenshotStyle}, appearance settings, theme selector, density slider, preview panel, 16:9`,
      "landscape_16_9",
    ),
  },
];

export const galleryCategories = [
  "All",
  "Onboarding",
  "Core",
  "Settings",
] as const satisfies readonly ScreenshotCategory[];

export const heroDeviceMockUrl = imgUrl(
  "sleek device mockup displaying a modern streaming and IPTV interface, dark theme with purple accents, minimal glassmorphism, high-end product hero image, studio lighting, 16:9",
  "landscape_16_9",
);
