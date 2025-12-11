
export interface ApiRequestPayload {
  image: string; // base64 data URI
  config?: {
    brandColor?: string;
  };
  requestId: string;
}

export interface ApiResponsePayload {
  zip: string; // base64 data URI
}

export const listenForApiRequests = (
  handler: (data: ApiRequestPayload) => Promise<void>
) => {
  const listener = (event: MessageEvent) => {
    // Basic validation of the message structure
    const { data } = event;
    if (data && data.type === 'ICON_FORGE_REQUEST' && data.payload) {
      // Pass the payload merged with requestId to the handler
      handler({ ...data.payload, requestId: data.requestId });
    }
  };

  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
};

export const sendApiResponse = (payload: ApiResponsePayload, requestId: string) => {
  // Post back to the source window (if inside iframe, parent; if opener, opener)
  const target = window.opener || window.parent;
  // Prevent sending to self if not in frame/popup
  if (target && target !== window) {
    target.postMessage({
      type: 'ICON_FORGE_RESPONSE',
      requestId,
      payload
    }, '*');
  }
};
