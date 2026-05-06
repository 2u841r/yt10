import { SiGithub } from "@icons-pack/react-simple-icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, CopyIcon, ExternalLinkIcon, StarIcon, TerminalIcon } from "lucide-react";
import { Suspense } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuthSuspense } from "@/lib/auth/hooks";

/**
 * This is the intro component for TanStarter, which you may delete after creating the project.
 * Have fun!
 */
export function IntroPageDeleteMe() {
  const [isCopied, setIsCopied] = useState(false);

  const repoUrl = "https://github.com/2u841r";
  const cloneCommand = "pnpm create mugnavo";
  const fallbackStarsCount = 1000;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(cloneCommand);
      setIsCopied(true);
      toast.success("Command copied to clipboard", { position: "top-center", richColors: false });

      setTimeout(() => {
        setIsCopied(false);
      }, 4000);
    } catch {
      toast.error("Failed to copy command", { position: "top-center" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pt-16 pb-12 md:pt-32">
        <header className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <a href={repoUrl} className="flex items-center gap-2 hover:underline">
              <img
                src="https://mugnavo.com/favicon-32x32.png"
                alt="Mugnavo logo"
                className="size-5 md:size-6"
              />
              <span className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                YT-Bot
              </span>
            </a>
            <div className="flex items-center gap-2">
              {/* <RepoStarsBadge href={repoUrl} fallbackStarsCount={fallbackStarsCount} /> */}
              <ThemeToggle />
            </div>
          </div>

          <h1 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            A <span className="text-red-500 dark:text-red-500">youtube</span> bot for reply comments
          </h1>
        </header>

        <Suspense fallback={<div className="py-6">Loading session...</div>}>
          <UserAction />
        </Suspense>

        <footer className="mt-auto flex flex-col items-center justify-between gap-6 text-sm md:flex-row">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <SiGithub className="size-4" />
            GitHub
          </a>
          <a
            href="https://zubairiz.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 underline decoration-border transition-all hover:decoration-foreground"
          >
            Zubair
            <ExternalLinkIcon className="size-4" />
          </a>
        </footer>
      </div>
    </div>
  );
}

function UserAction() {
  const { user } = useAuthSuspense();

  return user ? (
    <section className="mb-20 flex flex-col items-center space-y-1.5">
      {/* <div className="mb-4 flex w-full items-center gap-2">
        <div className="size-2 animate-pulse rounded-full bg-primary"></div>
        <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
          Session
        </h2>
      </div>
      <div className="mb-3 w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-border"></div>
            <div className="size-2.5 rounded-full bg-border"></div>
            <div className="size-2.5 rounded-full bg-border"></div>
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              useAuthSuspense() data
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/70 uppercase">ReadOnly</span>
        </div>
        <div className="overflow-x-auto p-6">
          <pre className="font-mono text-xs leading-relaxed text-foreground/80">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </div> */}

      <Button render={<Link to="/login" />} className="w-fit" size="lg" nativeButton={false}>
        Go to /app
      </Button>
      <SignOutButton />
    </section>
  ) : (
    <section className="mb-20 space-y-1 text-center">
      <p>You are not signed in.</p>
      <Button render={<Link to="/login" />} className="w-fit" size="lg" nativeButton={false}>
        Log in
      </Button>
    </section>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function RepoStarsBadge({
  href,
  fallbackStarsCount,
}: {
  href: string;
  fallbackStarsCount: number;
}) {
  const { data } = useQuery({
    queryKey: ["github-repo-stars"],
    queryFn: ({ signal }) => fetchRepoStars({ signal }),
    staleTime: 1000 * 60 * 30,
    retry: 1,
    enabled: typeof window !== "undefined",
  });

  const count = data || fallbackStarsCount;
  const formattedStarsCount = formatGitHubStars(count);
  const starsLabel = `${count.toLocaleString()}${data ? "" : "+"} stars on GitHub`;

  return (
    <Button
      render={
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={starsLabel}
          title={starsLabel}
        />
      }
      nativeButton={false}
      variant="secondary"
      className="tracking-wide"
    >
      <SiGithub className="size-4" />
      {formattedStarsCount}
      {data ? "" : "+"}
      <StarIcon
        fill="currentColor"
        strokeWidth={0}
        className="size-4 text-yellow-500 dark:text-yellow-300"
      />
    </Button>
  );
}

function formatGitHubStars(count: number) {
  if (count < 1000) {
    return count.toLocaleString();
  }

  const compactValue = count / 1000;
  const roundedValue =
    compactValue >= 10 ? Math.round(compactValue) : Math.round(compactValue * 10) / 10;

  return `${roundedValue.toLocaleString(undefined, {
    maximumFractionDigits: compactValue >= 10 ? 0 : 1,
    minimumFractionDigits: 0,
  })}k`;
}

async function fetchRepoStars({ signal }: { signal: AbortSignal | undefined }) {
  const response = await fetch("https://api.github.com/repos/mugnavo/tanstarter", {
    signal,
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch repository stars");
  }

  const data: unknown = await response.json();

  if (
    typeof data !== "object" ||
    data === null ||
    !("stargazers_count" in data) ||
    typeof data.stargazers_count !== "number"
  ) {
    throw new Error("Invalid repository response");
  }

  return data.stargazers_count;
}

interface TechBadge {
  alt: string;
  href: string;
  src: string;
}

const CORE_BADGES: TechBadge[] = [
  {
    alt: "React version",
    href: "https://react.dev",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.dependencies.react&label=react&style=flat-square",
  },
  {
    alt: "React Compiler version",
    href: "https://react.dev/learn/react-compiler",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.devDependencies%5B%22babel-plugin-react-compiler%22%5D&label=react-compiler&style=flat-square",
  },
  {
    alt: "TanStack Start version",
    href: "https://tanstack.com/start/latest",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.dependencies%5B%22%40tanstack%2Freact-start%22%5D&label=tanstack-start&style=flat-square",
  },
  {
    alt: "TanStack Query version",
    href: "https://tanstack.com/query/latest",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.dependencies%5B%22%40tanstack%2Freact-query%22%5D&label=tanstack-query&style=flat-square",
  },
];

const UI_BADGES: TechBadge[] = [
  {
    alt: "Tailwind CSS version",
    href: "https://tailwindcss.com/",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.devDependencies.tailwindcss&label=tailwindcss&style=flat-square",
  },
  {
    alt: "shadcn/ui version",
    href: "https://ui.shadcn.com/",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.dependencies.shadcn&label=shadcn%2Fui&style=flat-square",
  },
  {
    alt: "Base UI version",
    href: "https://base-ui.com/",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.dependencies%5B%22%40base-ui%2Freact%22%5D&label=base-ui&style=flat-square",
  },
];

const DATA_BADGES: TechBadge[] = [
  {
    alt: "Drizzle ORM version",
    href: "https://orm.drizzle.team/",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.dependencies%5B%22drizzle-orm%22%5D&label=drizzle-orm&style=flat-square",
  },
  {
    alt: "Better Auth version",
    href: "https://www.better-auth.com/",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.dependencies%5B%22better-auth%22%5D&label=better-auth&style=flat-square",
  },
];

const PLATFORM_BADGES: TechBadge[] = [
  {
    alt: "Vite version",
    href: "https://vite.dev",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.devDependencies.vite&label=vite&style=flat-square",
  },
  {
    alt: "Nitro version",
    href: "https://nitro.build/",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.devDependencies.nitro&label=nitro&style=flat-square",
  },
];

const TOOLING_BADGES: TechBadge[] = [
  {
    alt: "Oxlint version",
    href: "https://oxc.rs/docs/guide/usage/linter.html",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.devDependencies.oxlint&label=oxlint&style=flat-square",
  },
  {
    alt: "Oxfmt version",
    href: "https://oxc.rs/docs/guide/usage/formatter.html",
    src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmugnavo%2Ftanstarter%2Fmain%2Fpackage.json&query=%24.devDependencies.oxfmt&label=oxfmt&style=flat-square",
  },
];

const TECH_BADGE_ROWS = [CORE_BADGES, UI_BADGES, DATA_BADGES, PLATFORM_BADGES, TOOLING_BADGES];
