import { ICONCORE_REQUEST, ICONCORE_RESPONSE } from '@iconcore/shared';

export interface ApiRequestPayload {
  image: string;
  config?: {
    brandColor?: string;
  };
  requestId: string;
}

export interface ApiResponsePayload {
  zip: string;
}

export const listenForApiRequests = (
  handler: (data: ApiRequestPayload) => Promise<void>
) => {
  const listener = (event: MessageEvent) => {
    const { data } = event;
    if (data && data.type === ICONCORE_REQUEST && data.payload) {
      handler({ ...data.payload, requestId: data.requestId });
    }
  };

  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
};

export const sendApiResponse = (payload: ApiResponsePayload, requestId: string) => {
  const target = window.opener || window.parent;
  if (target && target !== window) {
    target.postMessage(
      {
        type: ICONCORE_RESPONSE,
        requestId,
        payload
      },
      '*'
    );
  }
};
