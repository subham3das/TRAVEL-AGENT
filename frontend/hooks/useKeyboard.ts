import { useEffect } from "react";

interface KeyBinding {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
}

export function useKeyboard(bindings: KeyBinding[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const binding of bindings) {
        const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase();
        const ctrlMatch = binding.ctrlKey ? event.ctrlKey : true;
        const altMatch = binding.altKey ? event.altKey : true;
        const metaMatch = binding.metaKey ? event.metaKey : true;

        if (keyMatch && ctrlMatch && altMatch && metaMatch) {
          event.preventDefault();
          binding.action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bindings]);
}
