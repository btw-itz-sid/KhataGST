// frontend/src/components/LoadingSpinner.tsx
// Reusable loading spinner with glassmorphic styling

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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
      <div
        style={{
          width: px,
          height: px,
          borderRadius: "50%",
          border: `3px solid rgba(108, 99, 255, 0.2)`,
          borderTop: `3px solid #6c63ff`,
          animation: "spin 0.8s linear infinite",
        }}
      />
      {message && (
        <p style={{ color: "#888", fontSize: "13px", margin: 0 }}>{message}</p>
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
        background: "#0a0a0f",
      }}>
        {spinner}
      </div>
    );
  }

  return spinner;
}
