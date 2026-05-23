declare namespace JSX {
  interface IntrinsicElements {
    "google-cast-launcher": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
  }
}

interface Window {
  __onGCastApiAvailable?: (isAvailable: boolean) => void;
  __branchAnnounceCastListenerAttached?: boolean;
  cast?: {
    framework: {
      CastContext: {
        getInstance(): {
          setOptions(options: {
            receiverApplicationId: string;
            autoJoinPolicy: string;
          }): void;
          getSessionState?(): string;
          addEventListener(type: string, listener: () => void): void;
        };
      };
      CastContextEventType: {
        SESSION_STATE_CHANGED: string;
      };
      SessionState: {
        SESSION_STARTED: string;
        SESSION_RESUMED: string;
      };
    };
  };
  chrome?: {
    cast: {
      AutoJoinPolicy: {
        ORIGIN_SCOPED: string;
      };
      media: {
        DEFAULT_MEDIA_RECEIVER_APP_ID: string;
      };
    };
  };
}
