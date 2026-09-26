// Les couleurs viennent de src/theme/tokens.ts, posées en variables CSS à la
// racine (ThemeProvider) : une classe comme `bg-paper` suit le thème clair ou sombre.
const color = (name) => `var(--${name})`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        paper: color('paper'),
        raised: color('raised'),
        sunk: color('sunk'),
        ink: color('ink'),
        ink2: color('ink2'),
        ink3: color('ink3'),
        brass: color('brass'),
        rod: color('rod'),
        rule: color('rule'),
        'rule-strong': color('rule-strong'),
        control: color('control'),
        stage: color('stage'),
        'primary-bg': color('primary-bg'),
        'primary-fg': color('primary-fg'),
        pill: color('pill'),
        positive: color('positive'),
        'positive-soft': color('positive-soft'),
        caution: color('caution'),
        'caution-soft': color('caution-soft'),
      },
      fontFamily: {
        body: ['HankenGrotesk_400Regular'],
        'body-medium': ['HankenGrotesk_500Medium'],
        'body-semibold': ['HankenGrotesk_600SemiBold'],
        'body-bold': ['HankenGrotesk_700Bold'],
        display: ['InstrumentSerif_400Regular'],
        'display-italic': ['InstrumentSerif_400Regular_Italic'],
      },
    },
  },
  plugins: [],
};
