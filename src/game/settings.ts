export type Settings = {
  soundEnabled: boolean;
  highContrast: boolean;
  haptics: boolean;
};

export function createDefaultSettings(): Settings {
  return {
    soundEnabled: true,
    highContrast: false,
    haptics: true,
  };
}
