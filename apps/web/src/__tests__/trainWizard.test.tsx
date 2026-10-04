import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TrainWizard, { stepForError, toTrainFailure, type TrainWizardProps } from '../components/TrainWizard.js';

// Roadmap 44 K4: the Workshop's training wizard, one question per step.
const types = [
  { index: 0, label: 'Basilisk', summary: 'A hard-hitting serpent.', class: 'Barbarian', signatureCard: 'Coil' },
  { index: 6, label: 'Dragon', summary: 'A clever, vain wizard.', class: 'Wizard', signatureCard: 'Fire Breath' },
];
const pronouns = [
  { key: 'male', label: 'he/him' },
  { key: 'female', label: 'she/her' },
  { key: 'androgynous', label: 'they/them' },
];

const setup = (overrides: Partial<TrainWizardProps> = {}) => {
  const props: TrainWizardProps = {
    types,
    pronouns,
    needsCharacter: false,
    characterCreation: { pronouns, avatars: ['🦊', '🐙'], suggestedName: 'Ada Lovelace' },
    shuffleAvatars: vi.fn(),
    busy: false,
    suggestNames: vi.fn().mockResolvedValue(['Vesper', 'Ember']),
    onTrain: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
  render(<TrainWizard {...props} />);
  return props;
};

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
const back = () => fireEvent.click(screen.getByRole('button', { name: 'Back' }));

/** Walks a Dragon, she/her, "Vesper" to the Look step. */
const toLook = () => {
  fireEvent.click(screen.getByRole('radio', { name: /Dragon/ }));
  next();
  fireEvent.click(screen.getByRole('radio', { name: 'she/her' }));
  next();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Vesper' } });
  next();
};

describe('TrainWizard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs Type, Pronouns, Name, Look, Ready, counting five steps', () => {
    setup();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pick a type' })).toBeInTheDocument();
    next();
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pronouns' })).toBeInTheDocument();
    next();
    expect(screen.getByRole('heading', { name: 'Name' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rex' } });
    next();
    expect(screen.getByRole('heading', { name: 'Look' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'green' } });
    next();
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ready' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('starts with About you, and counts it, on a first run', () => {
    setup({ needsCharacter: true });
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About you' })).toBeInTheDocument();
    expect(screen.getByText('This is you, the beastmaster. Your monsters fight; you train them.')).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toHaveValue('Ada Lovelace');
    next();
    expect(screen.getByText('Step 2 of 6')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pick a type' })).toBeInTheDocument();
  });

  it('shows each type as a card with its class and signature card', () => {
    setup();
    expect(screen.getByText('A hard-hitting serpent.')).toBeInTheDocument();
    expect(screen.getByText('Class: Barbarian · Signature card: Coil')).toBeInTheDocument();
    expect(screen.getByText('Class: Wizard · Signature card: Fire Breath')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('keeps every answer when you go Back', () => {
    setup();
    toLook();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ember red' } });
    back();
    expect(screen.getByLabelText('Name')).toHaveValue('Vesper');
    back();
    expect(screen.getByRole('radio', { name: 'she/her' })).toBeChecked();
    back();
    expect(screen.getByRole('radio', { name: /Dragon/ })).toBeChecked();
    next();
    next();
    next();
    expect(screen.getByRole('textbox')).toHaveValue('ember red');
  });

  it('disables Next until the name and the look are valid', () => {
    setup();
    next();
    next();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rex' } });
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    next();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x'.repeat(100) } });
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('treats Enter in a text box as Next, but not when the answer is not valid yet', () => {
    setup();
    next();
    next();
    const box = screen.getByLabelText('Name');
    fireEvent.submit(box.closest('form')!);
    expect(screen.getByRole('heading', { name: 'Name' })).toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'Rex' } });
    fireEvent.submit(box.closest('form')!);
    expect(screen.getByRole('heading', { name: 'Look' })).toBeInTheDocument();
  });

  it('asks the pronoun question for the chosen type', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: /Dragon/ }));
    next();
    expect(screen.getByText('Which pronouns should we use for your Dragon?')).toBeInTheDocument();
  });

  it('fills the name box from a suggestion chip, and "More names" asks again', async () => {
    const props = setup();
    next();
    next();
    fireEvent.click(await screen.findByRole('button', { name: 'Vesper' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Vesper');
    expect(screen.getByText('Suggestions:')).toBeInTheDocument();
    expect(props.suggestNames).toHaveBeenCalledTimes(1);
    expect(props.suggestNames).toHaveBeenCalledWith({ type: 0, gender: 'androgynous' });
    fireEvent.click(screen.getByTitle('Suggest two other names'));
    await waitFor(() => expect(props.suggestNames).toHaveBeenCalledTimes(2));
  });

  it('refreshes the suggestions when the type or pronouns changed', async () => {
    const props = setup();
    next();
    next();
    await screen.findByRole('button', { name: 'Vesper' });
    back();
    fireEvent.click(screen.getByRole('radio', { name: 'she/her' }));
    next();
    await waitFor(() => expect(props.suggestNames).toHaveBeenCalledTimes(2));
    expect(props.suggestNames).toHaveBeenLastCalledWith({ type: 0, gender: 'female' });
  });

  it('works without chips when the suggestions cannot load', async () => {
    const props = setup({ suggestNames: vi.fn().mockRejectedValue(new Error('offline')) });
    next();
    next();
    await waitFor(() => expect(props.suggestNames).toHaveBeenCalled());
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByTitle('Suggest two other names')).toBeInTheDocument();
  });

  it('asks the look question for the type and pronouns, with the example as the hint', () => {
    setup();
    toLook();
    expect(screen.getByText('What should her scales look like?')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'deep-sea blue with an ember-red belly');
  });

  it('previews the look: the example, muted, while the box is empty, then live as you type', () => {
    setup();
    toLook();
    expect(screen.getByText("In Vesper's description:")).toBeInTheDocument();
    const preview = screen.getByText(/Her scales are deep-sea blue with an ember-red belly\./);
    expect(preview).toHaveClass('is-example');
    expect(preview).toHaveTextContent('Example:');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ember Red' } });
    const live = screen.getByText('Her scales are ember red.');
    expect(live).not.toHaveClass('is-example');
  });

  it('shows the Ready summary and trains with the same input the form sent', async () => {
    const props = setup();
    toLook();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ember Red ' } });
    next();
    expect(screen.getByText('Vesper the Dragon')).toBeInTheDocument();
    expect(screen.getByText('Pronouns: she/her')).toBeInTheDocument();
    expect(screen.getByText('Her scales are ember red.')).toBeInTheDocument();
    expect(screen.getByText("The rest of Vesper's description is drawn when she answers your call.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Train Vesper' }));
    await waitFor(() => expect(props.onTrain).toHaveBeenCalledWith({ type: 6, gender: 'female', name: 'Vesper', color: 'Ember Red' }));
  });

  it('agrees the verb with they', () => {
    setup();
    next();
    next();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rex' } });
    next();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'green' } });
    next();
    expect(screen.getByText("The rest of Rex's description is drawn when they answer your call.")).toBeInTheDocument();
  });

  it('sends the character with the monster on a first run', async () => {
    const props = setup({ needsCharacter: true });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('radio', { name: '🐙' }));
    next();
    next();
    next();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rex' } });
    next();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'green' } });
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Train Rex' }));
    await waitFor(() => expect(props.onTrain).toHaveBeenCalledWith({
      type: 0, gender: 'androgynous', name: 'Rex', color: 'green',
      character: { name: 'Ada', gender: 'androgynous', avatar: '🐙' },
    }));
  });

  it('returns to the Name step with the message when the name is taken', async () => {
    const onTrain = vi.fn().mockResolvedValue({ message: 'That monster name is already taken.' });
    setup({ onTrain });
    next();
    next();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rex' } });
    next();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'green' } });
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Train Rex' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That monster name is already taken.');
    expect(screen.getByRole('heading', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Rex');
  });

  it('maps refusals to the step at fault by exact message or by named field', () => {
    expect(stepForError({ message: 'That monster name is already taken.' }, false)).toBe('name');
    expect(stepForError({ message: 'That name is already taken in this room.' }, true)).toBe('about');
    expect(stepForError({ message: 'That name is already taken in this room.' }, false)).toBe('ready');
    expect(stepForError({ message: 'That monster type is not available.' }, false)).toBe('type');
    // Loose words no longer steer: a message that merely mentions a type or a name stays on Ready.
    expect(stepForError({ message: 'Something about your type or name' }, true)).toBe('ready');
    expect(stepForError({ message: 'x', fields: ['color'] }, false)).toBe('look');
    expect(stepForError({ message: 'x', fields: ['gender'] }, false)).toBe('pronouns');
    expect(stepForError({ message: 'x', fields: ['character'] }, true)).toBe('about');
    expect(stepForError({ message: 'x', fields: ['character'] }, false)).toBe('ready');
    expect(stepForError({ message: 'x', fields: ['roomId'] }, false)).toBe('ready');
  });

  it('reads a failed input check as the field it names', () => {
    const issues = JSON.stringify([{ path: ['color'], message: 'String must contain at most 100 character(s)' }]);
    expect(toTrainFailure(new Error(issues))).toEqual({
      message: 'String must contain at most 100 character(s)',
      fields: ['color'],
    });
    expect(toTrainFailure(new Error('That monster name is already taken.'))).toEqual({ message: 'That monster name is already taken.' });
    expect(toTrainFailure('nope').message).toBe('Could not train that monster');
  });

  it('ignores a suggestion answer that is not for the latest request', async () => {
    const resolvers: Array<(names: string[]) => void> = [];
    const suggestNames = vi.fn(() => new Promise<string[]>((resolve) => { resolvers.push(resolve); }));
    setup({ suggestNames });
    next();
    next();
    fireEvent.click(screen.getByTitle('Suggest two other names'));
    await waitFor(() => expect(resolvers).toHaveLength(2));
    resolvers[1]!(['Newer', 'Fresh']);
    await screen.findByRole('button', { name: 'Newer' });
    resolvers[0]!(['Older', 'Stale']);
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: 'Older' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeInTheDocument();
  });

  it('sends the training once on a double submit', async () => {
    let finish: (value: null) => void = () => undefined;
    const onTrain = vi.fn(() => new Promise<null>((resolve) => { finish = resolve; }));
    setup({ onTrain });
    next();
    next();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rex' } });
    next();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'green' } });
    next();
    const form = screen.getByRole('button', { name: 'Train Rex' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onTrain).toHaveBeenCalledTimes(1);
    finish(null);
  });

  it('gives the buttons their titles', async () => {
    setup();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('title', 'Go to the next step');
    next();
    expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute('title', 'Go back to the last step');
    next();
    fireEvent.click(await screen.findByRole('button', { name: 'Vesper' }));
    expect(screen.getByRole('button', { name: 'Vesper' })).toHaveAttribute('title', 'Use Vesper as the name');
    next();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'green' } });
    next();
    expect(screen.getByRole('button', { name: 'Train Vesper' })).toHaveAttribute('title', 'Train Vesper with these answers');
  });
});
