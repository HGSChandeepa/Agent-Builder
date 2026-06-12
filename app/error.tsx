"use client";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h1>
      <p style={{ color: "#64748b", textAlign: "center", maxWidth: "28rem" }}>
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        style={{
          borderRadius: "0.375rem",
          border: "1px solid #d7e1f0",
          background: "#2563eb",
          color: "#fff",
          padding: "0.5rem 1rem",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </main>
  );
}
