/** Nav icon display size (matches pre-rendered PNG assets). */
export const NAV_ICON_SIZE = 28;

export function navIconUrls() {
  const base = "/visuals/display/daemon-icon";
  return {
    src: `${base}.png`,
    srcSet: `${base}.png 1x, ${base}@2x.png 2x`,
  };
}

/** CSS display size for phone mockups (matches pre-rendered PNG assets). */
export const PHONE_DISPLAY_WIDTH = 270;
export const PHONE_DISPLAY_HEIGHT = 603;

export type ScreenAssetId =
  | "hero-home"
  | "chat-local"
  | "onboarding-model"
  | "hive-datasets"
  | "hive-rewards";

export function screenAssetUrls(id: ScreenAssetId) {
  const base = `/screens/display/${id}`;
  return {
    src: `${base}.png`,
    srcSet: `${base}.png 1x, ${base}@2x.png 2x`,
  };
}
