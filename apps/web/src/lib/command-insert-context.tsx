import { createContext, useContext, useRef, type ReactNode } from 'react';

interface CommandInsertContextValue {
  insertCommand: (command: string) => void;
  registerInsertFn: (fn: (command: string) => void) => void;
}

const CommandInsertContext = createContext<CommandInsertContextValue | null>(null);

export function CommandInsertProvider({ children }: { children: ReactNode }) {
  const insertFnRef = useRef<((command: string) => void) | null>(null);

  function registerInsertFn(fn: (command: string) => void) {
    insertFnRef.current = fn;
  }

  function insertCommand(command: string) {
    insertFnRef.current?.(command);
  }

  return (
    <CommandInsertContext.Provider value={{ insertCommand, registerInsertFn }}>
      {children}
    </CommandInsertContext.Provider>
  );
}

export function useCommandInsert(): CommandInsertContextValue {
  const ctx = useContext(CommandInsertContext);
  if (!ctx) throw new Error('useCommandInsert must be used within CommandInsertProvider');
  return ctx;
}
