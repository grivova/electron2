declare module '*.png';
declare module '*.svg';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.bmp';
declare module '*.tiff';

declare module 'fs';
declare module 'path';
declare module 'os';

interface Config {
    backendUrl: string;
}

interface Window {
    electronAPI: {
      getAppConfig: () => Promise<Config>;
      onCardDetected: (callback: (uid: string) => void) => void;
      removeCardDetectedListeners: () => void;
    };
}