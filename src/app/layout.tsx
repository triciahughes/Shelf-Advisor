import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shelf Advisor",
  description:
    "AI book recommendations, compared across models, with token and cost visibility.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
