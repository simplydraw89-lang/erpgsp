import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/lib/theme-context"

export const metadata: Metadata = {
  title: "GSP Group | Enterprise Workspace",
  description:
    "Workspace terpadu Gema Sinergi Peradaban dengan kontrol, persetujuan, dan audit lintas modul.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var pref = localStorage.getItem('gsp_theme_preference') || 'time';
                  var hour = new Date().getHours();
                  var isDark = pref === 'dark' || (pref === 'time' && (hour < 6 || hour >= 18));
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="transition-colors duration-200">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
