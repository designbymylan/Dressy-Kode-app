/**
 * Les polices de la galerie, appelées par rôle. La charte est dessinée en
 * HelveticaNow (payante) : sur iPhone, Helvetica Neue, déjà installée sur
 * l'appareil, la remplace ; sur le web, la pile Helvetica Neue, Helvetica,
 * Arial. La graisse 520 de la charte tombe sur Medium.
 *
 * Partout dans l'app : `...F.s500` (jamais un nom de police en dur).
 * `accent` est l'ancien italique serif : il devient un Regular, qui fait
 * contraste avec le Medium des titres sans changer de famille.
 */
import { Platform, type TextStyle } from 'react-native';

type W = 400 | 500 | 600 | 700;

const IOS: Record<W, string> = { 400: 'HelveticaNeue', 500: 'HelveticaNeue-Medium', 600: 'HelveticaNeue-Medium', 700: 'HelveticaNeue-Bold' };
const WEB_WEIGHT: Record<W, TextStyle['fontWeight']> = { 400: '400', 500: '500', 600: '500', 700: '700' };
const STACK = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function make(w: W): TextStyle {
  return (
    Platform.select<TextStyle>({
      ios: { fontFamily: IOS[w] },
      web: { fontFamily: STACK, fontWeight: WEB_WEIGHT[w] },
      default: { fontFamily: w >= 500 ? 'sans-serif-medium' : 'sans-serif', fontWeight: w >= 700 ? '700' : 'normal' },
    }) ?? {}
  );
}

export const F = { s400: make(400), s500: make(500), s600: make(600), s700: make(700), accent: make(400) } as const;
