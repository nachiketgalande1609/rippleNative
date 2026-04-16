// Web stub — react-native-webrtc is native-only.
// On web, the real browser WebRTC APIs are used directly in AppContent.tsx.
// This file just prevents import errors in the web bundle.

export const RTCPeerConnection = (globalThis as any).RTCPeerConnection ?? null;
export const RTCIceCandidate   = (globalThis as any).RTCIceCandidate   ?? null;
export const RTCSessionDescription = (globalThis as any).RTCSessionDescription ?? null;

export const mediaDevices = {
  getUserMedia: (constraints: any) =>
    navigator.mediaDevices?.getUserMedia(constraints) ?? Promise.reject("Not supported"),
};

export class MediaStream {}

// RTCView has no web equivalent — render nothing
import React from "react";
export const RTCView = (_props: any) => null;