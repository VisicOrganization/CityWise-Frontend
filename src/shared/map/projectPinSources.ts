import type { MarkerCategory } from "./mapTypes";

/**
 * Council-file pin artwork by category, shared by `/map` and the embed.
 *
 * One table rather than one per surface: the two render council files on the same kind of map,
 * and a resident who sees a Housing pin on the council office's page and again on citywise.app
 * should be looking at the same pin.
 */
export const PROJECT_PIN_SRC: Record<MarkerCategory, string> = {
  "Housing": "/images/pins/housing.svg",
  "Education": "/images/pins/education.svg",
  "Infrastructure": "/images/pins/infrastructure.svg",
  "Public Resources": "/images/pins/public-resources.svg",
  "Equity & Community Works": "/images/pins/equity-and-community-works.svg",
  "Environmental": "/images/pins/environmental.svg",
  "Public Safety": "/images/pins/public-safety.svg",
  "Economic": "/images/pins/economic.svg",
  "Miscellaneous": "/images/pins/miscellaneous.svg",
};
