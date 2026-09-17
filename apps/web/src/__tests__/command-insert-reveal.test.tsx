import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CommandInsertProvider, useCommandInsert } from '../lib/command-insert-context.js';
import type { SurfaceId } from '../components/surfaces.js';

/**
 * Before the surfaces-in-slots work the console was always on screen, so inserting a
 * command could assume someone was listening. Now it is one of five surfaces competing for
 * two slots: the handbook's "Monster Manual" quick link did nothing at all when the console
 * was not in one, because `insertCommand` optional-chained a ref only ConsolePane sets.
 * See 10-bug-fixes.md H.
 */
function Harness({
  onInsert,
  onReveal,
  registerConsole,
}: {
  onInsert: (command: string) => void;
  onReveal: (surfaceId: SurfaceId) => void;
  registerConsole: boolean;
}) {
  const { insertCommand, registerInsertFn, registerRevealSurface } = useCommandInsert();

  return (
    <div>
      <button onClick={() => registerRevealSurface(onReveal)}>register host</button>
      {/* A fresh closure per registration, as a new ConsolePane instance would be. */}
      {registerConsole && (
        <button onClick={() => { unregister = registerInsertFn((cmd) => onInsert(cmd)); }}>
          register console
        </button>
      )}
      <button onClick={() => unregister?.()}>unmount console</button>
      <button onClick={() => insertCommand('look at monster manual')}>insert</button>
    </div>
  );
}

let unregister: (() => void) | undefined;

const click = (name: string) => act(() => { screen.getByText(name).click(); });

describe('inserting a command reveals the console first', () => {
  it('asks the host to show the console', () => {
    const onReveal = vi.fn();
    render(
      <CommandInsertProvider>
        <Harness onInsert={vi.fn()} onReveal={onReveal} registerConsole />
      </CommandInsertProvider>,
    );

    click('register host');
    click('register console');
    click('insert');

    expect(onReveal).toHaveBeenCalledWith('console');
  });

  it('delivers the command once a console registers, instead of dropping it', () => {
    // The failure the report describes: no console mounted, so the click did nothing and
    // the reference panel just closed.
    const onInsert = vi.fn();
    const { rerender } = render(
      <CommandInsertProvider>
        <Harness onInsert={onInsert} onReveal={vi.fn()} registerConsole={false} />
      </CommandInsertProvider>,
    );

    click('insert');
    expect(onInsert).not.toHaveBeenCalled();

    rerender(
      <CommandInsertProvider>
        <Harness onInsert={onInsert} onReveal={vi.fn()} registerConsole />
      </CommandInsertProvider>,
    );
    click('register console');

    expect(onInsert).toHaveBeenCalledWith('look at monster manual');
  });

  it('delivers immediately when a console is already listening', () => {
    const onInsert = vi.fn();
    render(
      <CommandInsertProvider>
        <Harness onInsert={onInsert} onReveal={vi.fn()} registerConsole />
      </CommandInsertProvider>,
    );

    click('register console');
    click('insert');

    expect(onInsert).toHaveBeenCalledWith('look at monster manual');
  });

  it('holds only the most recent command', () => {
    const onInsert = vi.fn();
    const { rerender } = render(
      <CommandInsertProvider>
        <Harness onInsert={onInsert} onReveal={vi.fn()} registerConsole={false} />
      </CommandInsertProvider>,
    );

    click('insert');
    click('insert');

    rerender(
      <CommandInsertProvider>
        <Harness onInsert={onInsert} onReveal={vi.fn()} registerConsole />
      </CommandInsertProvider>,
    );
    click('register console');

    expect(onInsert).toHaveBeenCalledTimes(1);
  });

  it('does not replay a flushed command when the console re-registers', () => {
    // ConsolePane re-registers on re-render; replaying would re-run the command.
    const onInsert = vi.fn();
    render(
      <CommandInsertProvider>
        <Harness onInsert={onInsert} onReveal={vi.fn()} registerConsole />
      </CommandInsertProvider>,
    );

    click('register console');
    click('insert');
    click('register console');

    expect(onInsert).toHaveBeenCalledTimes(1);
  });

  it('still works with no host registered — the console may already be visible', () => {
    const onInsert = vi.fn();
    render(
      <CommandInsertProvider>
        <Harness onInsert={onInsert} onReveal={vi.fn()} registerConsole />
      </CommandInsertProvider>,
    );

    click('register console');
    click('insert');

    expect(onInsert).toHaveBeenCalledWith('look at monster manual');
  });

  /**
   * The P2 from review: registration had no cleanup, so an unmounted console's setter stayed
   * in the ref — after a room change, say, with the console in neither retained slot.
   * `insertCommand` then took the deliver-now branch, called into a dead component, and did
   * not hold the command, so the console mounting moments later got nothing.
   * See 10b-bugs-fixed.md #133.
   */
  it('holds the command when the registered console has gone away', () => {
    const onInsert = vi.fn();
    render(
      <CommandInsertProvider>
        <Harness onInsert={onInsert} onReveal={vi.fn()} registerConsole />
      </CommandInsertProvider>,
    );

    click('register console');
    click('unmount console');
    click('insert');

    // Nothing was called into, and nothing was thrown away.
    expect(onInsert).not.toHaveBeenCalled();

    click('register console');

    expect(onInsert).toHaveBeenCalledWith('look at monster manual');
  });

  it("does not let an old console's cleanup clobber a newer registration", () => {
    const older = vi.fn();
    render(
      <CommandInsertProvider>
        <Harness onInsert={older} onReveal={vi.fn()} registerConsole />
      </CommandInsertProvider>,
    );

    click('register console');
    const staleUnregister = unregister;
    click('register console');
    act(() => staleUnregister?.());

    click('insert');

    expect(older).toHaveBeenCalledWith('look at monster manual');
  });
});