export type InterestSignupRole = 'coach' | 'guardian' | 'player' | 'other';

export interface InterestSignup {
  id: string;
  name: string;
  email: string;
  role: InterestSignupRole;
  reviewed: boolean;
  createdAt: unknown;
}
