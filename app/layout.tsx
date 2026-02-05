import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pro-se Prime",
  description: "A legal-information-only coaching tool for self-represented litigants.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={styles.body}>
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <Link href="/" style={styles.brand}>
              Pro-se Prime
            </Link>

            <nav style={styles.nav}>
              <Link href="/intake" style={styles.navLink}>Intake</Link>
              <Link href="/coach" style={styles.navLink}>Coach</Link>
              <Link href="/outputs" style={styles.navLink}>Outputs</Link>
              <Link href="/review" style={styles.navLink}>Review</Link>
            </nav>
          </div>
        </header>

        <div style={styles.container}>{children}</div>

        <footer style={styles.footer}>
          <div style={styles.footerInner}>
            <div style={{ fontWeight: 800 }}>Legal information only</div>
            <div style={{ opacity: 0.8, lineHeight: 1.4 }}>
              Pro-se Prime does not provide legal advice, does not create an attorney–client relationship,
              and does not guarantee outcomes. If you are in immediate danger, call local emergency services.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    margin: 0,
    background: "#f6f7fb",
    color: "#111827",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid #e5e7eb",
  },
  headerInner: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  brand: {
    textDecoration: "none",
    color: "#111827",
    fontWeight: 900,
    letterSpacing: -0.2,
    fontSize: 16,
  },
  nav: { display: "flex", gap: 10, flexWrap: "wrap" },
  navLink: {
    textDecoration: "none",
    color: "#111827",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontWeight: 700,
    fontSize: 13,
  },
  container: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "18px 18px 36px",
    minHeight: "calc(100vh - 140px)",
  },
  footer: {
    borderTop: "1px solid #e5e7eb",
    background: "#ffffff",
  },
  footerInner: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "14px 18px",
    display: "grid",
    gap: 6,
    fontSize: 12,
    color: "#374151",
  },
};