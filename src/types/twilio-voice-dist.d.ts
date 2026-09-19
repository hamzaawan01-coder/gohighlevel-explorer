// The self-contained UMD browser bundle has no type declarations; it sets
// window.Twilio when imported. Types come from the main package instead.
declare module "@twilio/voice-sdk/dist/twilio.min.js";
