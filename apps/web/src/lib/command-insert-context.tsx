import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

import type { SurfaceId } from '../components/surfaces.js';

interface CommandInsertContextValue {
  insertCommand: (command: string) => void;
  /** Returns an unregister function; the console must call it on unmount. */
  registerInsertFn: (fn: (command: string) => void) => () => void;
  /**
   * Lets the surface host (`Terminal`) say how to bring a surface into view. Registered
   * rather than imported so this context stays independent of the layout that happens to
   * be hosting the surfaces.
   */
  registerRevealSurface: (fn: (surfaceId: SurfaceId) => void) => void;
}

const CommandInsertContext = createContext<CommandInsertContextValue | null>(null);

export function CommandInsertProvider({ children }: { children: ReactNode }) {
  const insertFnRef = useRef<((command: string) => void) | null>(null);
  const revealFnRef = useRef<((surfaceId: SurfaceId) => void) | null>(null);
  const pendingCommandRef = useRef<string | null>(null);

  /*
   * A command inserted while the console is not mounted used to vanish: `insertCommand`
   * called `insertFnRef.current?.(command)`, and that optional chain silently did nothing.
   * Before the surfaces-in-slots work the console was always on screen, so the ref was
   * always set. Now it is one of five surfaces competing for two slots, and the handbook's
   * quick links — "Monster Manual" and friends — did nothing at all when it was not in one.
   *
   * Two things are needed, because revealing is not instant: ask the host to show the
   * console, then hold the command until a console actually registers. See
   * 10-bug-fixes.md H.
   */
  const registerInsertFn = useCallback((fn: (command: string) => void) => {
    insertFnRef.current = fn;

    const pending = pendingCommandRef.current;
    if (pending !== null) {
      pendingCommandRef.current = null;
      fn(pending);
    }

    /*
     * Registration without an unregister left a dead console's setter in the ref after it
     * unmounted — on a room change, say, when the console is in neither retained slot.
     * `insertCommand` would then take the deliver-now branch, call into an unmounted
     * component, and *not* hold the command; the console that mounted moments later got
     * nothing. Only clear when the ref still points at this registration, so a newer
     * console's is never clobbered by an older one's cleanup. See 10b-bugs-fixed.md #133.
     */
    return () => {
      if (insertFnRef.current === fn) insertFnRef.current = null;
    };
  }, []);

  const registerRevealSurface = useCallback((fn: (surfaceId: SurfaceId) => void) => {
    revealFnRef.current = fn;
  }, []);

  const insertCommand = useCallback((command: string) => {
    // Commands run in the console, so that is what has to be on screen to see the answer.
    revealFnRef.current?.('console');

    if (insertFnRef.current) {
      insertFnRef.current(command);
      return;
    }

    // No console yet. The reveal above should mount one; `registerInsertFn` flushes this.
    pendingCommandRef.current = command;
  }, []);

  // Stable, so consumers can depend on these in effects without re-running every render.
  const value = useMemo(
    () => ({ insertCommand, registerInsertFn, registerRevealSurface }),
    [insertCommand, registerInsertFn, registerRevealSurface]
  );

  return <CommandInsertContext.Provider value={value}>{children}</CommandInsertContext.Provider>;
}

export function useCommandInsert(): CommandInsertContextValue {
  const ctx = useContext(CommandInsertContext);
  if (!ctx) throw new Error('useCommandInsert must be used within CommandInsertProvider');
  return ctx;
}
