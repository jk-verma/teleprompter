import { useEffect, useState } from "react"

const FALLBACK_README = `TelePrompter

This page mirrors the repository README so the in-app instructions stay in sync with the project.
`

export const HomePage = () => {
  const [readmeText, setReadmeText] = useState(FALLBACK_README)

  useEffect(() => {
    let active = true

    const loadReadme = async () => {
      try {
        const response = await fetch("./README.md", { cache: "no-store" })
        if (!response.ok) {
          return
        }

        const text = await response.text()
        if (active) {
          setReadmeText(text)
        }
      } catch {
        if (active) {
          setReadmeText(FALLBACK_README)
        }
      }
    }

    void loadReadme()

    return () => {
      active = false
    }
  }, [])

  return (
    <main className="home-page">
      <section className="readme-sheet">
        <div className="section-heading">
          <p className="eyebrow">README</p>
          <h1>TelePrompter</h1>
        </div>
        <div className="readme-raw">{readmeText}</div>
      </section>
    </main>
  )
}
