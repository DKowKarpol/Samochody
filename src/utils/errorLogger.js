/**
 * Error logging utility that writes error information to a backend log file.
 */

async function logErrorToBackend(errorData) {
  try {
    const response = await fetch("/api/error-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(errorData),
    });
    if (!response.ok) {
      console.error("Failed to log error to backend:", response.status);
    }
  } catch (err) {
    console.error("Failed to send error log to backend:", err);
  }
}

export function logError(context, error, additionalInfo = {}) {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : "";

  const errorData = {
    timestamp,
    context,
    message,
    stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    ...additionalInfo,
  };

  console.error(`[${context}]`, errorData);

  logErrorToBackend(errorData);
}

export function setupGlobalErrorHandlers() {
  // Handle uncaught errors
  window.addEventListener("error", (event) => {
    logError("window.onerror", event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    logError("unhandledrejection", event.reason, {
      promise: "Promise rejection",
    });
  });
}
