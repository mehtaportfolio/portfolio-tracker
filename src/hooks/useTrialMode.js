import { useMode } from "../context/ModeContext.jsx";

export const useTrialMode = () => {
  const { mode } = useMode();
  const isTrialMode = mode === "trial";

  const trialValue = (actualValue, defaultValue = 0) => {
    if (isTrialMode) {
      return defaultValue;
    }
    return actualValue;
  };

  return { isTrialMode, trialValue };
};
