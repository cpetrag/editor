import type { Metadata, Viewport } from 'next'
import {
  Geist,
  Geist_Mono,
  Poppins,
  Bebas_Neue,
  Playfair_Display,
  Space_Grotesk,
  Archivo_Black,
  Oswald,
  Montserrat,
  Anton,
  Inter,
  Alfa_Slab_One,
  Nunito,
  Lilita_One,
  Luckiest_Guy,
  Baloo_2,
  Titan_One,
  Caveat,
  Courier_Prime,
} from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { EditorErrorListeners } from '@/components/editor-error-listeners'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'block' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'block' })

// Fonts offered in the library for the video inserts.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'block',
})
const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas',
  display: 'block',
})
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-playfair',
  display: 'block',
})
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space',
  display: 'block',
})
const archivoBlack = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-archivo',
  display: 'block',
})
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
  display: 'block',
})
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'block',
})
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'block',
})
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'block',
})
const alfaSlab = Alfa_Slab_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-alfa',
  display: 'block',
})
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-nunito',
  display: 'block',
})
const lilita = Lilita_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-lilita',
  display: 'block',
})
const luckiest = Luckiest_Guy({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-luckiest',
  display: 'block',
})
const baloo = Baloo_2({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-baloo',
  display: 'block',
})
const titan = Titan_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-titan',
  display: 'block',
})
const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-caveat',
  display: 'block',
})
const courierPrime = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-courier',
  display: 'block',
})

const fontVariables = [
  geistSans.variable,
  geistMono.variable,
  poppins.variable,
  bebasNeue.variable,
  playfair.variable,
  spaceGrotesk.variable,
  archivoBlack.variable,
  oswald.variable,
  montserrat.variable,
  anton.variable,
  inter.variable,
  alfaSlab.variable,
  nunito.variable,
  lilita.variable,
  luckiest.variable,
  baloo.variable,
  titan.variable,
  caveat.variable,
  courierPrime.variable,
].join(' ')

export const metadata: Metadata = {
  title: 'Editor de Inserts — Automação de Marketing',
  description: 'Configure inserts dinâmicos sobre vídeos de fundo e exporte com Remotion.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`bg-background ${fontVariables}`}
      suppressHydrationWarning
    >
      <body className="antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <EditorErrorListeners />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
