import type { Gender } from '../catalog';
import type { AwardId } from '../../types/awards';
import type { ExerciseCategory } from '../../types/exercise';
import type { ObjectiveStatus } from '../../types/developmentPlan';
import type { Competition, Grade, MatchStatus, PointReason, Skill } from '../../types/match';
import type { Level, PositionCategory, SkillKey } from '../../types/player';
import type { BodyweightExercise, PhysicalTestType, WeightedExercise } from '../../types/physicalTest';

/** Labels for stored codes. Keys are the codes; saved values never change. English ignores `g`. */
export const labels = {
  skill: {
    S: 'Serve',
    R: 'Reception',
    A: 'Attack',
    B: 'Block',
    D: 'Dig',
    E: 'Set',
    F: 'Free ball',
  } as Record<Skill, string>,
  /** DataVolley grades with a per-skill meaning. A missing key = grade not offered. */
  grade: {
    S: { '#': 'Ace', '+': 'Pressure', '!': 'OK', '-': 'Easy', '/': 'Free back', '=': 'Error' },
    R: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '/': 'Overpass', '=': 'Aced' },
    A: { '#': 'Kill', '+': 'Good', '!': 'Covered', '-': 'Easy dig', '/': 'Blocked', '=': 'Error' },
    B: { '#': 'Stuff', '+': 'Touch ours', '-': 'Touch theirs', '/': 'Tooled', '=': 'Net' },
    D: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '/': 'Overpass', '=': 'Error' },
    E: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '=': 'Error' },
    F: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '/': 'Overpass', '=': 'Error' },
  } as Record<Skill, Partial<Record<Grade, string>>>,
  pointReason: {
    oppError: 'Opp. error',
    oppKill: 'Opp. kill',
    oppAce: 'Opp. ace',
    oppBlock: 'Opp. block',
    unknown: 'Other',
  } as Record<PointReason, string>,
  /** The nine skills scored on a player card. */
  playerSkill: {
    serve: 'Serve',
    attack: 'Attack',
    block: 'Block',
    set: 'Set',
    defence: 'Defence',
    reception: 'Reception',
    jump: 'Jump',
    speed: 'Speed',
    iq: 'IQ',
  } as Record<SkillKey, string>,
  position: {
    S: () => 'Setter',
    OH: () => 'Outside',
    O: () => 'Opposite',
    MB: () => 'Middle',
    L: () => 'Libero',
    U: () => 'Universal',
    TBD: () => 'TBD',
  } as Record<PositionCategory, (g: Gender) => string>,
  level: {
    Beginner: () => 'Beginner',
    Developing: () => 'Developing',
    Advanced: () => 'Advanced',
    Elite: () => 'Elite',
  } as Record<Level, (g: Gender) => string>,
  objectiveStatus: {
    Active: 'Active',
    'In progress': 'In progress',
    Completed: 'Completed',
    'Not started': 'Not started',
    Attention: 'Attention',
  } as Record<ObjectiveStatus, string>,
  exerciseCategory: {
    warmup: 'Warm-up',
    physical: 'Physical',
    service: 'Service',
    setting: 'Setting',
    defense: 'Defense',
    reception: 'Reception',
    attack: 'Attack',
    compound: 'Compound',
    game: 'Game',
  } as Record<ExerciseCategory, string>,
  /** Keyed by the English focus word used in exercise names. */
  exerciseFocus: {
    'Warm-up': 'Warm-up',
    Physical: 'Physical',
    Test: 'Test',
    Serve: 'Serve',
    Reception: 'Reception',
    'Free ball': 'Free ball',
    Setting: 'Setting',
    Attack: 'Attack',
    Defense: 'Defense',
    Transition: 'Transition',
    Combination: 'Combination',
    Game: 'Game',
  } as Record<string, string>,
  awardTitle: {
    mvp: () => 'MVP',
    topScorer: () => 'Top scorer',
    attacker: () => 'Best attacker',
    server: () => 'Best server',
    receiver: () => 'Best receiver',
    blocker: () => 'Best blocker',
    defender: () => 'Best defender',
    setter: () => 'Best setter',
    mostImproved: () => 'Most improved',
    everPresent: () => 'Ever-present',
  } as Record<AwardId, (g: Gender) => string>,
  competition: {
    league: 'League',
    cup: 'Cup',
    friendly: 'Friendly',
    tournament: 'Tournament',
  } as Record<Competition, string>,
  matchStatus: {
    setup: 'Setup',
    live: 'Live',
    finished: 'Finished',
  } as Record<MatchStatus, string>,
  /** The physical tests (Task 8 players, Task 9 testing sessions). */
  physicalTest: {
    growth: 'Growth',
    cmj: 'Countermovement Jump',
    approachJump: 'Approach Jump',
    broadJump: 'Standing Broad Jump',
    sprint10m: '10m Sprint',
    shuttle5105: '5-10-5 Shuttle',
    reaction: 'Reaction Time',
    strength: 'Strength',
  } as Record<PhysicalTestType, string>,
  strengthExercise: {
    trapBarDeadlift: 'Trap-bar deadlift',
    squat: 'Squat',
    gobletSquat: 'Goblet squat',
    pushUps: 'Push-ups',
    splitSquat: 'Split squat',
  } as Record<WeightedExercise | BodyweightExercise, string>,
};
