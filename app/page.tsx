import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
      
      {/* Hero Section */}
      <section style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", 
        gap: "40px", 
        alignItems: "center" 
      }}>
        
        {/* Left Column: Text & Actions */}
        <div>
          <h1 className="h1" style={{ fontSize: "44px", lineHeight: "1.1" }}>
            Pro-se Prime
          </h1>
          <p className="muted" style={{ fontSize: "19px", margin: "20px 0 32px", maxWidth: "480px" }}>
            A guided, legal-information-only coach to help self-represented litigants organize facts, 
            focus arguments, and prepare for court.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "32px" }}>
            <Link href="/intake" className="btn btn-primary">
              Start intake
            </Link>
            <Link href="/coach" className="btn">
              Go to coach
            </Link>
          </div>

          <div className="banner-warning" style={{ fontSize: "14px", maxWidth: "480px" }}>
            <strong>Not legal advice.</strong> This tool helps you structure your story and prepare your presentation.
          </div>
        </div>

        {/* Right Column: "What it produces" Glass Card */}
        <div className="card">
          <div className="h2">What it produces</div>
          <ul style={{ 
            margin: "0", 
            paddingLeft: "20px", 
            display: "grid", 
            gap: "12px", 
            color: "var(--text-muted)",
            fontSize: "15px"
          }}>
            <li>Adaptive follow-up questions to fill gaps</li>
            <li>2-minute oral script for court</li>
            <li>5-minute oral outline</li>
            <li>Timeline + evidence checklist</li>
            <li>“Review-ready” summary packet</li>
          </ul>
          
          <div className="hr" />
          
          <div className="small">
            MVP Focus: <b>NY Family Court</b> (Orders of Protection & Custody).
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
        
        <Link href="/intake" className="card" style={{ textDecoration: "none", transition: "transform 0.2s" }}>
          <div className="h2" style={{ fontSize: "20px" }}>1. Intake</div>
          <p className="muted" style={{ fontSize: "15px", marginBottom: "20px" }}>
            Collect the goal, people, timeline, and evidence in a structured, stress-free way.
          </p>
          <span style={{ color: "var(--brand)", fontWeight: 600, fontSize: "14px" }}>Start intake →</span>
        </Link>

        <Link href="/coach" className="card" style={{ textDecoration: "none", transition: "transform 0.2s" }}>
          <div className="h2" style={{ fontSize: "20px" }}>2. Coach</div>
          <p className="muted" style={{ fontSize: "15px", marginBottom: "20px" }}>
            The AI asks adaptive follow-ups to narrow to the legally relevant facts and sharpen your story.
          </p>
          <span style={{ color: "var(--brand)", fontWeight: 600, fontSize: "14px" }}>Chat with coach →</span>
        </Link>

        <Link href="/outputs" className="card" style={{ textDecoration: "none", transition: "transform 0.2s" }}>
          <div className="h2" style={{ fontSize: "20px" }}>3. Outputs</div>
          <p className="muted" style={{ fontSize: "15px", marginBottom: "20px" }}>
            Generate the final script, outline, timeline, and evidence list ready for the judge.
          </p>
          <span style={{ color: "var(--brand)", fontWeight: 600, fontSize: "14px" }}>View outputs →</span>
        </Link>

      </section>
    </main>
  );
}
