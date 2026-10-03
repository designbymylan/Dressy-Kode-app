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
        card: color('card'),
        'card-edge': color('card-edge'),
        'glass-strong': color('glass-strong'),
        faint: color('faint'),
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
        butter: color('butter'),
        'butter-ink': color('butter-ink'),
      },
    },
  },
  plugins: [],
};
