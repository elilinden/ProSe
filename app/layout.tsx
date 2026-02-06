import type { Metadata } from "next";
import Link from "next/link";
import "../styles/globals.css"; // Crucial: Loads your glass theme

export const metadata: Metadata = {
  title: "Pro-se Prime",
  description: "A legal-information-only coaching tool for self-represented litigants.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="header-glass">
          <div className="header-inner">
            <Link href="/" className="brand">
              Pro-se Prime
            </Link>

            <nav className="nav">
              <Link href="/intake" className="nav-link">Intake</Link>
              <Link href="/coach" className="nav-link">Coach</Link>
              <Link href="/outputs" className="nav-link">Outputs</Link>
              <Link href="/review" className="nav-link">Review</Link>
            </nav>
          </div>
        </header>

        <div className="container">{children}</div>

        <footer className="footer">
          <div className="footer-inner">
            <div style={{ fontWeight: 600 }}>Legal information only</div>
            <div className="muted" style={{ fontSize: "13px" }}>
              Pro-se Prime does not provide legal advice, does not create an attorney–client relationship,
              and does not guarantee outcomes. If you are in immediate danger, call local emergency services.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
