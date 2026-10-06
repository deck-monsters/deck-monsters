import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { SPAWN_ERRORS, lookEntry, lookPreview, lookQuestionShort } from '@deck-monsters/engine';

/*
 * The Workshop's Train monster wizard (roadmap 44 K4). It replaces a one-screen form that
 * asked for a type, pronouns, a name and "Appearance" (with `gold and black` as the hint for
 * every type) all at once. One question per screen, each with an example, ending in a Ready
 * screen that shows what the look line will read like. The answers still go out as the same
 * `spawnMonster` input the old form sent; only how they are gathered changed.
 *
 * Every step's answer lives here, not in the step, so Back never loses anything.
 */

type Gender = 'male' | 'female' | 'androgynous';

export type TrainWizardType = {
  index: number;
  label: string;
  summary?: string;
  class?: string;
  signatureCard?: string;
};

export type TrainWizardInput = {
  type: number;
  gender: Gender;
  name: string;
  color: string;
  character?: { name: string; gender: Gender; avatar: string };
};

type StepId = 'about' | 'type' | 'pronouns' | 'name' | 'look' | 'ready';

export type TrainWizardProps = {
  types: TrainWizardType[];
  pronouns: Array<{ key: string; label: string }>;
  /** First run: the wizard opens with the About you step and sends the character along. */
  needsCharacter: boolean;
  /** Only read on a first run; older test doubles omit it. */
  characterCreation?: { pronouns: Array<{ key: string; label: string }>; avatars: string[]; suggestedName: string };
  shuffleAvatars?: () => unknown;
  busy: boolean;
  /** Two names for this type and pronouns; may reject (the wizard then shows no chips). */
  suggestNames: (input: { type: number; gender: Gender; exclude?: string[] }) => Promise<string[]>;
  /** Resolves with what went wrong, or null when the monster was trained. */
  onTrain: (input: TrainWizardInput) => Promise<TrainFailure | null>;
};

// The look question and preview take the possessive; "answers" agrees with "he".
// A small local table because the engine's pronoun set lives beside Node-only code.
const PRONOUN_WORDS: Record<Gender, { he: string; his: string; answers: string }> = {
  male: { he: 'he', his: 'his', answers: 'answers' },
  female: { he: 'she', his: 'her', answers: 'answers' },
  androgynous: { he: 'they', his: 'their', answers: 'answer' },
};

const STEP_HEADINGS: Record<StepId, string> = {
  about: 'About you',
  type: 'Pick a type',
  pronouns: 'Pronouns',
  name: 'Name',
  look: 'Look',
  ready: 'Ready',
};

/** A refused train: the message to show, and the input fields the server named, if it did. */
export type TrainFailure = { message: string; fields?: string[] };

/**
 * Reads a thrown tRPC error. A failed input check arrives with a JSON list of issues as its
 * message; the first path segment of each says which field failed (`name`, `color`, ...).
 */
export const toTrainFailure = (err: unknown): TrainFailure => {
  const raw = err instanceof Error ? err.message : 'Could not train that monster';
  try {
    const issues: unknown = JSON.parse(raw);
    if (Array.isArray(issues) && issues.length > 0) {
      const fields = issues.map((issue) => String((issue as { path?: unknown[] })?.path?.[0] ?? '')).filter(Boolean);
      const messages = issues.map((issue) => String((issue as { message?: unknown })?.message ?? '')).filter(Boolean);
      return { message: messages.join(' ') || raw, fields };
    }
  } catch {
    // Not JSON: an ordinary refusal, matched by its exact wording below.
  }
  return { message: raw };
};

const FIELD_STEPS: Record<string, StepId> = { type: 'type', gender: 'pronouns', name: 'name', color: 'look', character: 'about' };

// Which step a refusal belongs to, so a name clash lands you on Name, not on Ready. Exact
// messages (shared with the server as SPAWN_ERRORS) and named fields only; anything else
// stays on Ready with the message, rather than guessing from words in it.
export const stepForError = (failure: TrainFailure, needsCharacter: boolean): StepId => {
  const { message, fields = [] } = failure;
  if (message === SPAWN_ERRORS.monsterNameTaken) return 'name';
  if (message === SPAWN_ERRORS.characterNameTaken) return needsCharacter ? 'about' : 'ready';
  if (message === SPAWN_ERRORS.typeUnavailable) return 'type';
  const step = fields.map((field) => FIELD_STEPS[field]).find((id): id is StepId => id !== undefined);
  return step === 'about' && !needsCharacter ? 'ready' : (step ?? 'ready');
};

const asGender = (key: string): Gender => (key === 'male' || key === 'female' ? key : 'androgynous');

export default function TrainWizard({
  types,
  pronouns,
  needsCharacter,
  characterCreation = { pronouns: [], avatars: [], suggestedName: '' },
  shuffleAvatars,
  busy,
  suggestNames,
  onTrain,
}: TrainWizardProps) {
  const steps: StepId[] = needsCharacter
    ? ['about', 'type', 'pronouns', 'name', 'look', 'ready']
    : ['type', 'pronouns', 'name', 'look', 'ready'];
  // The step is held by name, not index. On a first run the server creates the character before
  // it checks the monster's name, so a name clash leaves the character made; the next inventory
  // refresh drops About you from `steps`, and an index would then point one step too far (the
  // whole-branch review of pass 44 found Name turning into Look).
  const [stepId, setStepId] = useState<StepId>(steps[0]!);
  const stepIndex = Math.max(steps.indexOf(stepId), 0);
  const step = steps[stepIndex]!;
  const setStepIndex = (next: number | ((at: number) => number)) => {
    const at = typeof next === 'function' ? next(stepIndex) : next;
    setStepId(steps[Math.min(Math.max(at, 0), steps.length - 1)]!);
  };

  const [characterName, setCharacterName] = useState<string | null>(null);
  const [characterGender, setCharacterGender] = useState<Gender>('androgynous');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [typeIndex, setTypeIndex] = useState<number | null>(null);
  const [gender, setGender] = useState<Gender>('androgynous');
  const [name, setName] = useState('');
  const [look, setLook] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ key: string; names: string[] }>({ key: '', names: [] });
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The suggested name and the avatars arrive after the first render; show them until the player types.
  const effectiveCharacterName = characterName ?? characterCreation.suggestedName;
  const effectiveAvatar =
    avatar !== null && characterCreation.avatars.includes(avatar) ? avatar : (characterCreation.avatars[0] ?? '');
  const chosenType = types.find((type) => type.index === (typeIndex ?? types[0]?.index)) ?? types[0];
  const typeLabel = chosenType?.label ?? '';
  const words = PRONOUN_WORDS[gender];
  const pronounLabel = pronouns.find((p) => p.key === gender)?.label ?? gender;
  const trimmedName = name.trim();
  const trimmedLook = look.trim();
  const example = lookEntry(typeLabel).example;
  const previewLine = lookPreview(typeLabel, (trimmedLook || example).toLowerCase(), { his: words.his });

  // Only the newest request may set the chips: a slow answer for the old type or pronouns
  // must not overwrite the answer for the current ones (or a later "More names").
  const latestSuggestion = useRef(0);
  const submitting = useRef(false);
  const fetchSuggestions = useCallback(
    (typeValue: number, genderValue: Gender, exclude: string[] = []) => {
      const key = `${typeValue}:${genderValue}`;
      const request = ++latestSuggestion.current;
      suggestNames({ type: typeValue, gender: genderValue, ...(exclude.length > 0 ? { exclude } : {}) })
        .then((names) => {
          if (request === latestSuggestion.current) setSuggestions({ key, names: names.slice(0, 2) });
        })
        // No chips is fine: the box still works. The name lists are Node-only, so this can fail.
        .catch(() => {
          if (request === latestSuggestion.current) setSuggestions({ key, names: [] });
        });
    },
    [suggestNames],
  );

  // Entering Name refreshes the chips when the type or pronouns changed since the last fetch.
  const suggestionKey = chosenType ? `${chosenType.index}:${gender}` : '';
  useEffect(() => {
    if (step === 'name' && chosenType && suggestions.key !== suggestionKey) {
      fetchSuggestions(chosenType.index, gender);
    }
  }, [step, suggestionKey, chosenType, gender, suggestions.key, fetchSuggestions]);

  // Move focus to the new step's heading so a screen reader (and the keyboard) follows the wizard.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const valid: Record<StepId, boolean> = {
    about:
      effectiveCharacterName.trim().length >= 1 && effectiveCharacterName.trim().length <= 40 && effectiveAvatar !== '',
    type: chosenType !== undefined,
    pronouns: true,
    name: trimmedName.length >= 1 && trimmedName.length <= 40,
    look: trimmedLook.length >= 1 && trimmedLook.length <= 100,
    ready: true,
  };
  const canNext = valid[step];
  const last = step === 'ready';

  const goTo = (id: StepId) => {
    const at = steps.indexOf(id);
    setStepIndex(at === -1 ? steps.length - 1 : at);
  };

  async function train() {
    // A ref, set before the first await: a double Enter or tap in the same tick would
    // otherwise send two trainings (`busy` only turns true on the next render).
    if (!chosenType || busy || submitting.current) return;
    submitting.current = true;
    setError(null);
    let failure: TrainFailure | null;
    try {
      failure = await onTrain({
        type: chosenType.index,
        gender,
        name: trimmedName,
        color: trimmedLook,
        ...(needsCharacter
          ? { character: { name: effectiveCharacterName.trim(), gender: characterGender, avatar: effectiveAvatar } }
          : {}),
      });
    } finally {
      submitting.current = false;
    }
    if (failure !== null) {
      setError(failure.message);
      goTo(stepForError(failure, needsCharacter));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canNext) return;
    if (last) {
      void train();
      return;
    }
    setError(null);
    setStepIndex((at) => Math.min(at + 1, steps.length - 1));
  }

  return (
    <form className="train-wizard" onSubmit={handleSubmit}>
      <p className="train-wizard-step">Step {stepIndex + 1} of {steps.length}</p>
      <h2 id="train-wizard-heading" className="train-wizard-heading" tabIndex={-1} ref={headingRef}>
        {STEP_HEADINGS[step]}
      </h2>

      {step === 'about' && (
        <div className="train-wizard-body">
          <p className="train-wizard-lead">This is you, the beastmaster. Your monsters fight; you train them.</p>
          <label>Your name
            <input
              name="characterName"
              maxLength={40}
              autoComplete="off"
              value={effectiveCharacterName}
              onChange={(event) => setCharacterName(event.target.value)}
            />
          </label>
          <label>Pronouns
            <select name="characterGender" value={characterGender} onChange={(event) => setCharacterGender(asGender(event.target.value))}>
              {characterCreation.pronouns.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <fieldset className="workshop-avatar-choices">
            <legend>Avatar</legend>
            {characterCreation.avatars.map((choice, index) => (
              <label key={`${choice}-${index}`} className="workshop-avatar-chip">
                <input type="radio" name="avatar" value={choice} checked={effectiveAvatar === choice} onChange={() => setAvatar(choice)} />
                <span>{choice}</span>
              </label>
            ))}
            {/* The list is generated per request, so a new one is just a refetch. */}
            <button title="Show other icons to choose from" type="button" className="btn workshop-inline-btn" onClick={() => void shuffleAvatars?.()}>Shuffle</button>
          </fieldset>
        </div>
      )}

      {step === 'type' && (
        <fieldset className="train-wizard-body train-wizard-types">
          <legend className="event-sr-only">Pick a type</legend>
          {types.map((type) => {
            const selected = type.index === chosenType?.index;
            return (
              <label key={type.index} className={`train-wizard-type${selected ? ' is-selected' : ''}`}>
                <input type="radio" name="type" value={type.index} checked={selected} onChange={() => setTypeIndex(type.index)} />
                <span className="train-wizard-type-name">{type.label}</span>
                {type.summary && <span className="train-wizard-type-summary">{type.summary}</span>}
                {type.class && type.signatureCard && (
                  <span className="train-wizard-type-facts">Class: {type.class} · Signature card: {type.signatureCard}</span>
                )}
              </label>
            );
          })}
        </fieldset>
      )}

      {step === 'pronouns' && (
        <fieldset className="train-wizard-body train-wizard-pronouns">
          <legend className="train-wizard-lead">Which pronouns should we use for your {typeLabel}?</legend>
          {pronouns.map(({ key, label }) => (
            <label key={key} className={`train-wizard-choice${gender === key ? ' is-selected' : ''}`}>
              <input type="radio" name="gender" value={key} checked={gender === key} onChange={() => setGender(asGender(key))} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      )}

      {step === 'name' && (
        <div className="train-wizard-body">
          <label>Name
            <input name="name" maxLength={40} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="train-wizard-suggestions">
            <span>Suggestions:</span>
            {suggestions.names.map((suggestion) => (
              <button key={suggestion} type="button" className="btn train-wizard-chip" title={`Use ${suggestion} as the name`} onClick={() => setName(suggestion)}>{suggestion}</button>
            ))}
            <button
              type="button"
              className="btn workshop-inline-btn"
              title="Suggest two other names"
              onClick={() => chosenType && fetchSuggestions(chosenType.index, gender, suggestions.key === suggestionKey ? suggestions.names : [])}
            >
              More names
            </button>
          </div>
        </div>
      )}

      {step === 'look' && (
        <div className="train-wizard-body">
          <label>{lookQuestionShort(typeLabel, { his: words.his })}
            <input name="color" maxLength={100} autoComplete="off" placeholder={example} value={look} onChange={(event) => setLook(event.target.value)} />
          </label>
          <p className="train-wizard-preview-label">In {trimmedName}'s description:</p>
          <p className={`train-wizard-preview${trimmedLook ? '' : ' is-example'}`}>
            {!trimmedLook && <span className="event-sr-only">Example: </span>}
            {previewLine}
          </p>
        </div>
      )}

      {step === 'ready' && (
        <div className="train-wizard-body">
          <p className="train-wizard-ready-name">{trimmedName} the {typeLabel}</p>
          <p>Pronouns: {pronounLabel}</p>
          <p className="train-wizard-preview">{previewLine}</p>
          <p className="train-wizard-lead">The rest of {trimmedName}'s description is drawn when {words.he} {words.answers} your call.</p>
        </div>
      )}

      {error && <p className="error-msg" role="alert">{error}</p>}

      <div className="train-wizard-actions">
        {stepIndex > 0 && (
          <button type="button" className="btn" title="Go back to the last step" onClick={() => { setError(null); setStepIndex((at) => Math.max(at - 1, 0)); }}>Back</button>
        )}
        {last ? (
          <button type="submit" className="btn btn-cta" title={`Train ${trimmedName} with these answers`} disabled={busy}>Train {trimmedName}</button>
        ) : (
          <button type="submit" className="btn btn-cta" title="Go to the next step" disabled={!canNext}>Next</button>
        )}
      </div>
    </form>
  );
}
