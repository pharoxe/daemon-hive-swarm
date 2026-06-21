/**
 * JS-only stub so Metro can resolve `expo-local-authentication` without native code.
 * Replace this dependency with the real `expo-local-authentication` from npm (same import path)
 * and rebuild to enable device biometric / PIN gate for revealing keys.
 */
module.exports = {
  hasHardwareAsync: async () => true,
  isEnrolledAsync: async () => true,
  authenticateAsync: async () => {
    throw new Error("expo-local-authentication-stub");
  },
};
