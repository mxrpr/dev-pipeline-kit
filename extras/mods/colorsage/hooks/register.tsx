import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

// Newsprint by day, an old broadsheet under a desk lamp by night.
const newspaper = makeColors({
  label: 'Newspaper',
  roles: { accent: '#8a4b22', danger: '#a8322a', success: '#4f7a34', warning: '#a36a12', pro: '#6b4a6e' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#e9dcc3',
        'surface-1': '#efe4cf',
        'surface-2': '#f5ecdb',
        'text-primary': '#2b2018',
        'text-secondary': '#4f3f30',
        'text-muted': '#665443',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#1e1812',
        'surface-1': '#271f18',
        'surface-2': '#30271e',
        'surface-3': '#382e24',
        'text-primary': '#efe3cc',
        'text-secondary': '#cdbea4',
        'text-muted': '#ab9b82',
      },
    },
  },
})

// Calm gray-green with soft off-white text and little blue, for resting eyes.
const sage = makeColors({
  label: 'Sage dark',
  only: 'dark',
  roles: { accent: '#7fa58a', danger: '#c0796b', success: '#a3c584', warning: '#c4a25e', pro: '#a08fb0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#1f2622',
        'surface-1': '#252d28',
        'surface-2': '#2a332d',
        'surface-3': '#2f3832',
        'text-primary': '#d8d6c8',
        'text-secondary': '#b9b8aa',
        'text-muted': '#9aa39a',
      },
    },
  },
})

type Made = ReturnType<typeof makeColors>

// Serif type, like a printed column.
const SERIF: ThemeSetArgs['style'] = {
  Text: { fontFamily: ['serif'], fontSize: 15, lineHeight: 23 },
  Heading: { fontFamily: ['serif'], fontWeight: 'bold' },
}

async function apply($: EngineInterface, { theme, problems }: Made) {
  const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

  if (unpainted !== undefined) {
    $.ui.toast(unpainted)
  }

  let set

  try {
    set = await $.theme.set({ colors: theme, style: SERIF })
  } catch (error) {
    // An older build without `style` throws: keep the colors alone.
    $.ui.log(String(error))
    set = await $.theme.set({ colors: theme })
  }

  if (!set.isDrawn) {
    $.ui.status(set.reason)
  }
}

// One store key per look; turning one on turns the others off. 'on' is the key older versions stored.
const NEWSPAPER = { key: 'on', made: newspaper, label: 'Newspaper' }
const SAGE = { key: 'sage', made: sage, label: 'Sage dark' }
const LOOKS = [NEWSPAPER, SAGE]

async function toggle($: EngineInterface, look: (typeof LOOKS)[number]) {
  if ((await $.store.get(look.key)) === true) {
    await $.store.set(look.key, false)
    await $.theme.clear()

    return { text: `${look.label} colors off.` }
  }
  for (const other of LOOKS) {
    await $.store.set(other.key, other === look)
  }
  await apply($, look.made)

  return { text: `${look.label} colors on.` }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'colornewspaper', description: 'Turn the newspaper colors on or off' })
    await $.command.register({ name: 'colorsage', description: 'Turn the calm sage dark colors on or off' })

    // The choice outlives the session, so the theme comes back on its own.
    for (const look of LOOKS) {
      if ((await $.store.get(look.key)) === true) {
        await apply($, look.made)
        break
      }
    }

    return next(e)
  })

  on('command.run', { command: 'colornewspaper' }, $ => toggle($, NEWSPAPER))
  on('command.run', { command: 'colorsage' }, $ => toggle($, SAGE))
}
