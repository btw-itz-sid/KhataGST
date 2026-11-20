// frontend/src/components/LoadingSpinner.tsx
// Reusable loading spinner with neutral workspace styling

interface Props {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

const sizes = {
  sm: 24,
  md: 36,
  lg: 48,
};

export function LoadingSpinner({ message, size = "md", fullScreen = false }: Props) {
  const px = sizes[size];

  const spinner = (
    <div role="status" aria-label={message || "Loading"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
      <div
        style={{
          width: px,
          height: px,
          borderRadius: "50%",
          border: `3px solid #e4e4e7`,
          borderTop: `3px solid #18181b`,
          animation: "spin 0.8s linear infinite",
        }}
      />
      {message && (
        <p style={{ color: "#888", fontSize: "14px", margin: 0 }}>{message}</p>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafafa",
      }}>
        {spinner}
      </div>
    );
  }

  return spinner;
}
