import { Types } from 'mongoose';

/** Resolved scope for words routes (student + write policy + optional tutor principal). */
export interface WordsAccessContext {
  effectiveStudentId: Types.ObjectId;
  /**
   * Tutor/admin principals are always read-only on their own vocabulary (`words:write` applies to tutees only).
   * Non–tutor-eligible users: read-only when `words:write` is missing.
   */
  isSelfReadOnly: boolean;
  /**
   * Logged-in user id when the effective vocabulary belongs to someone else (e.g. tutor submitting for a tutee).
   * Omitted when the principal is working on their own words.
   */
  tutorId?: Types.ObjectId;
}
