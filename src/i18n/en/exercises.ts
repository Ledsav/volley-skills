import { plural } from '../plural';

export const exercises = {
  /** One text per import problem (see `exerciseImportIssueText`). */
  import: {
    notObject: (row: number) => `row ${row}: each entry must be a JSON object`,
    nameRequired: (row: number) => `row ${row}: "name" is required`,
    categoryInvalid: (row: number, options: string) => `row ${row}: "category" must be one of ${options}`,
    descriptionText: (row: number) => `row ${row}: "description" must be text`,
    minPlayersRange: (row: number, min: number, max: number) =>
      `row ${row}: "minPlayers" must be a whole number from ${min} to ${max}`,
    diagramsNotArray: (row: number) => `row ${row}: "diagrams" must be an array`,
    tooManyDiagrams: (row: number, max: number) => `row ${row}: at most ${max} diagrams per exercise`,
    diagramNotObject: (row: number, diagram: number) => `row ${row}: diagram ${diagram} must be an object`,
    diagramTitle: (row: number, diagram: number, max: number) =>
      `row ${row}: diagram ${diagram}: "title" must be 1–${max} characters`,
    diagramScene: (row: number, diagram: number, why: string) =>
      `row ${row}: diagram ${diagram}: scene is invalid (${why})`,
  },
  page: {
    title: 'Exercises',
    import: 'Import',
    importTitle: 'Import exercises',
    draftWithAi: 'Draft with AI',
    newExercise: 'New exercise',
    filterByCategory: 'Filter by category',
    all: 'All',
    none: 'No exercises yet.',
    loadError: 'Could not load exercises. Please refresh the page.',
    loadMoreError: 'Could not load more exercises. Please try again.',
    loadMore: 'Load more',
    deleteError: 'Could not delete the exercise. Please try again.',
    added: (n: number) => `Added ${n} ${plural('en', n, { one: 'exercise', other: 'exercises' })}.`,
    imported: (n: number) => `Imported ${n} ${plural('en', n, { one: 'exercise', other: 'exercises' })}.`,
    deleteTitle: (name: string) => `Delete ${name}?`,
    usageUnknown:
      'The number of trainings using this exercise could not be determined. Deleting it may leave some trainings with a missing exercise entry.',
    usedIn: (n: number) =>
      `This exercise is used in ${n} training(s). Deleting it will leave those trainings with a missing exercise entry.`,
    deletedNotice: (n: string) => `Exercise “${n}” deleted`,
    rowMenu: (n: string) => `Actions for ${n}`,
    edit: 'Edit',
    confirmDelete: 'Yes, delete exercise',
  },
  form: {
    editTitle: 'Edit exercise',
    newTitle: 'New exercise',
    nameRequired: 'Name is required.',
    minPlayersRange: (min: number, max: number) => `Minimum players must be a whole number from ${min} to ${max}.`,
    saveError: 'Could not save the exercise. Please try again.',
    createError: 'Could not create the exercise. Please try again.',
    offline:
      "You're offline. Creating an exercise and opening its diagram editor needs a connection; use Save instead, or try again when online.",
    createAndAdd: 'Create & add diagrams',
    saving: 'Saving…',
    name: 'Name',
    nameHint: (example: string, focuses: string) =>
      `Name it "Focus: what it trains", e.g. "${example}". Focus is one of: ${focuses}.`,
    category: 'Category',
    minPlayers: 'Minimum players',
    minPlayersHint: 'Fewest people needed to run it. Optional.',
    description: 'Description',
    diagrams: 'Diagrams',
    editDiagrams: 'Edit diagrams',
    openDiagram: (title: string) => `Open diagram ${title}`,
  },
  detail: {
    deleted: 'Deleted exercise',
    previousExercise: 'Previous exercise',
    nextExercise: 'Next exercise',
    previous: 'Previous',
    next: 'Next',
    position: (i: number, total: number) => `Exercise ${i} of ${total}`,
    minutes: (duration: number, from: number, to: number) => `${duration} min · min ${from}–${to}`,
    minPlayers: (n: number) => `Min ${n} players`,
    wasDeleted: 'This exercise was deleted from the library.',
    diagrams: 'Diagrams',
    loadingDiagrams: 'Loading diagrams…',
    diagramsError: 'Could not load the diagrams.',
    noDiagrams: 'No diagrams for this exercise.',
    description: 'Description',
    noDescription: 'No description.',
  },
};
