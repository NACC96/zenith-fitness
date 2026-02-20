import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1
          className="text-4xl font-bold tracking-[0.25em] text-lime"
          style={{ fontFamily: "var(--font-logo)" }}
        >
          ZENITH
        </h1>
        <p
          className="mt-3 text-text-secondary text-sm tracking-[0.5em] uppercase"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          FITNESS
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded-full bg-[#ff2d2d] px-10 py-4 text-base font-bold text-black shadow-[0_0_30px_rgba(255,45,45,0.3)] transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-[0_0_50px_rgba(255,45,45,0.5)]"
        >
          Enter Dashboard
        </Link>
      </div>
    </main>
  );
}
