import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-lime">
          Zenith Fitness
        </h1>
        <p className="mt-3 text-text-secondary font-mono text-sm">
          AI-powered workout tracking
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded-full bg-[#ccff00] px-10 py-4 text-base font-bold text-black shadow-[0_0_30px_rgba(204,255,0,0.3)] transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-[0_0_50px_rgba(204,255,0,0.5)]"
        >
          Enter Dashboard
        </Link>
      </div>
    </main>
  );
}
