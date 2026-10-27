import { plural } from '../plural';

const privacyNote = "Don't type names or other personal details — this text is sent to your AI provider.";

export const aiDraft = {
  /** Exercise and training name conventions: shown in the forms and given to the AI drafts. */
  naming: {
    exerciseExample: 'Reception: mixed serves to target',
    trainingExample: 'Reception + free ball: control and convert',
    trainingHint: (example: string) =>
      `Name it "Focus + focus: objective", e.g. "${example}". Age group and players have their own fields.`,
  },
  /** Parts of the AI prompts the coach's language changes; the rest of every prompt stays English. */
  prompt: {
    language: 'English',
    descriptionHeadings: {
      purpose: 'Purpose:',
      setup: 'Setup:',
      howItRuns: 'How it runs:',
      coachingPoints: 'Coaching points:',
      easier: 'Easier:',
      harder: 'Harder:',
    },
  },
  /** Why the model's proposal was repaired, shown under a proposal. */
  issues: {
    pickCategory: 'Pick a category.',
    noDiagram: 'No diagram was proposed.',
    diagramUnusable: 'The diagram could not be used.',
    itemsDropped: (n: number) => `${n} diagram ${plural('en', n, { one: 'item was', other: 'items were' })} dropped.`,
    stepsNotInLibrary: (n: number) =>
      `${n} ${plural('en', n, { one: 'step used an exercise that is', other: 'steps used exercises that are' })} not in the library and ${plural('en', n, { one: 'was', other: 'were' })} dropped.`,
    newExercisesOff: (n: number) =>
      `${n} new ${plural('en', n, { one: 'exercise was', other: 'exercises were' })} dropped because new exercises are off.`,
    newNoCategory: (n: number) =>
      `${n} new ${plural('en', n, { one: 'exercise had', other: 'exercises had' })} no valid category and ${plural('en', n, { one: 'was', other: 'were' })} dropped.`,
  },
  saveErrors: {
    needsCategory: (name: string) => `“${name}” needs a category.`,
    addFailed: (name: string) => `Could not add “${name}”.`,
    diagramMissing: (name: string) => `“${name}” was added without its diagram — add one in the diagram editor.`,
    alreadyAdded: (names: string) => `Already added: ${names}.`,
    trainingFailedKept: 'The new exercises were saved, but the training was not. Try Save again.',
    trainingFailed: 'Could not save the training. Please try again.',
    offlineExercises: "You're offline. Saving drafts needs a connection.",
    offlineTraining: "You're offline. Saving needs a connection.",
  },
  errors: {
    notConfigured: 'Set up an AI provider in Settings first.',
    unauthorized: 'Key rejected — check it in Settings.',
    rateLimited: 'Rate limit reached — try again in a moment.',
    unreachable: 'Could not reach the AI provider.',
    badResponse: "The model's answer could not be used. Try again or rephrase the request.",
    privacyBlocked: 'No provider for this model keeps requests private (zero data retention). Pick another model in Settings.',
    http: 'The AI provider returned an error.',
    rateLimitedIn: (sec: number) => `Rate limit reached — try again in ${sec} s.`,
    generic: 'Something went wrong. Please try again.',
  },
  badge: 'AI draft',
  saving: 'Saving…',
  drafting: 'Drafting…',
  openSettings: 'Open Settings',
  regenerate: 'Regenerate',
  generate: 'Generate',
  noDiagram: 'No diagram',
  exerciseDialog: {
    title: 'Draft exercises with AI',
    request: 'What do you need?',
    requestPlaceholder: 'Serve-receive drills for 9 players, U15, one court',
    privacy: privacyNote,
    category: 'Category',
    any: 'Any',
    howMany: 'How many',
    saveKept: (n: number) => `Save ${n} kept`,
  },
  trainingDialog: {
    title: 'Draft a training with AI',
    goal: 'Goal',
    goalPlaceholder: 'Serve receive under pressure, 12 players, one court',
    privacy: privacyNote,
    ageGroup: 'Age group',
    totalMinutes: 'Total minutes',
    suggestedPlayers: 'Suggested players',
    suggestedPlayersHint: 'Optional. The draft only uses drills this many players (±3) can run.',
    targets: 'Targets',
    allowNew: 'Allow new exercises',
    openInBuilder: 'Open in builder',
  },
  exerciseReview: {
    diagramFor: (name: string) => `Diagram for ${name}`,
    name: 'Name',
    category: 'Category',
    pickCategory: 'Pick a category',
    description: 'Description',
    addedToLibrary: 'Added to library',
    keep: 'Keep',
    keepAria: (name: string) => `Keep ${name}`,
    edit: 'Edit',
    done: 'Done',
    editAria: (name: string) => `Edit ${name}`,
    doneAria: (name: string) => `Done editing ${name}`,
  },
  trainingReview: {
    trainingName: 'Training name',
    ageGroupTarget: 'Age group target',
    description: 'Description',
    minutesOfTarget: (total: number, target: number) => `${total} / ${target} min`,
    steps: 'Steps',
    isNew: 'New',
    isLibrary: 'Library',
    view: (name: string) => `View ${name}`,
    minutesFor: (name: string) => `Minutes for ${name}`,
    moveUp: (name: string) => `Move ${name} up`,
    moveDown: (name: string) => `Move ${name} down`,
    remove: (name: string) => `Remove ${name}`,
    diagramFor: (name: string) => `Diagram for ${name}`,
  },
};
