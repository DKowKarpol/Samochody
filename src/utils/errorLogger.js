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
