import { ShelfAdvisor } from "@/components/ShelfAdvisor";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Shelf Advisor</h1>
        <p className="mt-2 text-neutral-500">
          Tell me what you loved. I&apos;ll find what to read next.
        </p>
      </header>
      <ShelfAdvisor />
    </main>
  );
}
