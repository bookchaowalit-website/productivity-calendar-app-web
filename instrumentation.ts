import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

export function register() {
  const options = sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // The Http integration records a session per incoming request unless told not to; errors only.
    Sentry.init({
      ...options,
      integrations: (defaults) => [
        ...options.integrations(defaults).filter((integration) => integration.name !== "Http"),
        Sentry.httpIntegration({ disableIncomingRequestSpans: true, sessions: false }),
      ],
    });
  } else {
    Sentry.init(options);
  }
}

export const onRequestError = Sentry.captureRequestError;
