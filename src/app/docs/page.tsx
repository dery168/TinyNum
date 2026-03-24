export default function DocsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f7f7f9" }}>
      <iframe
        title="TinyNum API Docs"
        src="/api/docs"
        style={{ border: 0, width: "100%", height: "100vh" }}
      />
    </main>
  );
}
