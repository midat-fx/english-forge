/**
 * Catalog IDs are persisted in profile tags and learning evidence. This is the
 * explicit history of IDs retired after their rows were accidentally rebound
 * to different targets. Never change a retired expression to make a new target
 * fit an old ID; add another migration entry with a new semantic ID instead.
 *
 * The expression pair also lets profile migrations retag only a card whose
 * canonical fingerprint proves that it represented the accidental new target.
 */
export const CATALOG_IDENTITY_MIGRATIONS = [
  ['lex-a2-one-way-or-return', 'One way or return?', 'lex-a2-single-or-return', 'Single or return?'],
  ['lex-b1-turn-out', 'turn out', 'lex-b1-fall-over', 'fall over'],
  ['lex-b1-point-out', 'point out', 'lex-b1-hand-out', 'hand out'],
  ['lex-b1-come-up-with', 'come up with', 'lex-b1-go-away', 'go away'],
  ['lex-b1-keep-up-with', 'keep up with', 'lex-b1-come-on', 'come on'],
  ['lex-b1-take-responsibility', 'take responsibility for', 'lex-b1-provide-information', 'provide information'],
  ['lex-b1-meet-deadline', 'meet a deadline', 'lex-b1-offer-advice', 'offer advice'],
  ['lex-b1-on-one-hand', 'on the one hand', 'lex-b1-after-all', 'after all'],
  ['lex-b1-far-as-know', 'as far as I know', 'lex-b1-in-spite-of', 'in spite of'],
  ['lex-b1-apparently', 'apparently', 'lex-b1-still', 'still'],
  ['lex-b1-aware', 'aware', 'lex-b1-predict', 'predict'],
  ['lex-b1-no-point', 'there is no point in', 'lex-b1-persuade-someone-to', 'persuade someone to'],
  ['lex-b1-tend-to', 'tend to', 'lex-b1-make-someone-do', 'make someone do'],
  ['lex-b1-moved-on-other-hand', 'on the other hand', 'lex-b1-according-to', 'according to'],
  ['lex-b1-extra-condition', 'condition', 'lex-b1-ordinary', 'ordinary'],
  ['lex-b1-extra-contribution', 'contribution', 'lex-b1-explore', 'explore'],
  ['lex-b1-extra-demand', 'demand', 'lex-b1-punish', 'punish'],
  ['lex-b1-extra-evidence', 'evidence', 'lex-b1-argue', 'argue'],
  ['lex-b1-extra-failure', 'failure', 'lex-b1-breathe', 'breathe'],
  ['lex-b1-extra-feature', 'feature', 'lex-b1-challenging', 'challenging'],
  ['lex-b1-extra-feedback', 'feedback', 'lex-b1-deliver', 'deliver'],
  ['lex-b1-extra-growth', 'growth', 'lex-b1-disagree', 'disagree'],
  ['lex-b1-extra-influence', 'influence', 'lex-b1-communicate', 'communicate'],
  ['lex-b1-extra-intention', 'intention', 'lex-b1-disappear', 'disappear'],
  ['lex-b1-extra-lifestyle', 'lifestyle', 'lex-b1-embarrassing', 'embarrassing'],
  ['lex-b1-extra-pressure', 'pressure', 'lex-b1-employ', 'employ'],
  ['lex-b1-extra-reaction', 'reaction', 'lex-b1-escape', 'escape'],
  ['lex-b1-extra-requirement', 'requirement', 'lex-b1-exist', 'exist'],
  ['lex-b1-extra-effective', 'effective', 'lex-b1-replace', 'replace'],
  ['lex-b1-extra-flexible', 'flexible', 'lex-b1-remind', 'remind'],
  ['lex-b1-extra-normal', 'normal', 'lex-b1-common', 'common'],
  ['lex-b1-extra-practical', 'practical', 'lex-b1-prove', 'prove'],
  ['lex-b1-extra-calculate', 'calculate', 'lex-b1-regret', 'regret'],
  ['lex-b1-extra-contribute', 'contribute', 'lex-b1-respect', 'respect'],
  ['lex-b1-extra-express', 'express', 'lex-b1-ashamed', 'ashamed'],
  ['lex-b1-extra-occur', 'occur', 'lex-b1-suffer', 'suffer'],
] as const

export type CatalogIdentityMigration = (typeof CATALOG_IDENTITY_MIGRATIONS)[number]
