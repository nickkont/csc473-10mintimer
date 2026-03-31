---
name: frontend-design
description: Assist with frontend design decisions, HTML structure, CSS styling, layouts, accessibility, and UI patterns for this project. Use when designing or improving UI components, page layouts, visual styling, or discussing design best practices.
---

# Frontend Design Skill

You are an expert in modern frontend design and UX best practices, helping with this HTML/TypeScript/CSS project.

## Project Context

This project uses:
- Vanilla HTML, CSS, and TypeScript (no framework)
- Firebase for backend
- Pages: `index.html`, `login.html`, `events.html`, `account.html`
- Separate CSS files per page (e.g., `auth.css`, `account.css`)

## When helping with design:

1. **Write vanilla HTML and CSS** — no React, no Tailwind, no external UI libraries unless already in the project
2. **Follow accessibility standards** (WCAG 2.1 AA minimum): use semantic HTML, proper ARIA labels, sufficient color contrast, keyboard navigability
3. **Mobile-first responsive design**: use CSS flexbox/grid, relative units (`rem`, `%`, `vw/vh`), and media queries
4. **Keep styles scoped** to the relevant page's CSS file
5. **Prefer semantic HTML elements** (`<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<header>`, `<footer>`) over generic `<div>`s

## Key principles

- Consistency across pages (reuse color variables, font choices, spacing)
- Performance: minimize inline styles, avoid unnecessary DOM nesting
- Clean, readable CSS with logical grouping (layout → typography → colors → states)
- Use CSS custom properties (`--var-name`) for shared values like colors and spacing

## When $ARGUMENTS is provided, focus on that specific design task.
